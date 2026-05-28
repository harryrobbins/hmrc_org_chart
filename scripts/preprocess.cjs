const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Let's resolve the exact file names dynamically in the workspace directory
const workspaceDir = 'C:\\Users\\harry\\Downloads\\hmrc';

function findCsvFiles() {
    const files = fs.readdirSync(workspaceDir);
    const seniorFile = files.find(f => f.endsWith('organogram-senior.csv'));
    const juniorFile = files.find(f => f.endsWith('organogram-junior.csv'));
    if (!seniorFile || !juniorFile) {
        throw new Error("Could not find CSV files in workspace!");
    }
    return {
        seniorPath: path.join(workspaceDir, seniorFile),
        juniorPath: path.join(workspaceDir, juniorFile)
    };
}

// Robust CSV parser that handles double quotes and commas
function parseCsvLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result.map(val => val.replace(/^"|"$/g, '').trim());
}

async function preprocess() {
    console.log("=== HMRC Data Preprocessor ===");
    const { seniorPath, juniorPath } = findCsvFiles();
    console.log(`Senior CSV: ${path.basename(seniorPath)}`);
    console.log(`Junior CSV: ${path.basename(juniorPath)}`);

    // 1. Process Senior CSV into Map
    const seniorMap = {};
    const seniorRl = readline.createInterface({
        input: fs.createReadStream(seniorPath),
        crlfDelay: Infinity
    });

    let isFirstSenior = true;
    for await (const line of seniorRl) {
        if (!line.trim()) continue;
        const cols = parseCsvLine(line);
        if (isFirstSenior) {
            isFirstSenior = false;
            continue;
        }

        const id = cols[0]; // Post Unique Reference
        const name = cols[1];
        const grade = cols[2];
        const jobTitle = cols[3];
        const jobFunction = cols[4];
        const parentDept = cols[5];
        const organisation = cols[6];
        const unit = cols[7];
        const email = cols[9];
        const reportsTo = cols[10]; // Reports to Senior Post
        const salaryCostStr = cols[11];
        const fteStr = cols[12];
        const payFloorStr = cols[13];
        const payCeilingStr = cols[14];
        const profession = cols[16];
        const region = cols[17];
        const notes = cols[18];

        if (!id) continue;

        // Note: Job share posts can have multiple records for the same post ID
        if (!seniorMap[id]) {
            seniorMap[id] = {
                id,
                names: [],
                grades: [],
                jobTitles: [],
                functions: [],
                unit: unit || 'Unknown',
                reportsTo: reportsTo || 'XX',
                salaryCost: 0,
                fte: 0,
                payFloor: null,
                payCeiling: null,
                professions: [],
                regions: [],
                emails: [],
                notes: [],
                juniorReports: [],
                children: []
            };
        }

        const post = seniorMap[id];
        if (name && name !== 'N/D' && name !== 'Vacant') {
            if (!post.names.includes(name)) post.names.push(name);
        } else if (name && post.names.length === 0) {
            post.names.push(name); // e.g. "N/D" or "Vacant"
        }

        if (grade && !post.grades.includes(grade)) post.grades.push(grade);
        if (jobTitle && !post.jobTitles.includes(jobTitle)) post.jobTitles.push(jobTitle);
        if (jobFunction && !post.functions.includes(jobFunction)) post.functions.push(jobFunction);
        if (email && !post.emails.includes(email)) post.emails.push(email);
        if (notes && notes !== 'nan' && !post.notes.includes(notes)) post.notes.push(notes);

        if (profession && !post.professions.includes(profession)) post.professions.push(profession);
        if (region && !post.regions.includes(region)) post.regions.push(region);

        // Sum up metrics for job shares
        const fteVal = parseFloat(fteStr) || 0;
        post.fte += fteVal;

        const salCost = parseFloat(salaryCostStr) || 0;
        post.salaryCost += salCost;

        const floor = parseFloat(payFloorStr);
        if (!isNaN(floor) && (post.payFloor === null || floor < post.payFloor)) {
            post.payFloor = floor;
        }

        const ceiling = parseFloat(payCeilingStr);
        if (!isNaN(ceiling) && (post.payCeiling === null || ceiling > post.payCeiling)) {
            post.payCeiling = ceiling;
        }
    }

    console.log(`Loaded ${Object.keys(seniorMap).length} unique senior posts.`);

    // 2. Parse Junior CSV and bind to senior posts
    const juniorRl = readline.createInterface({
        input: fs.createReadStream(juniorPath),
        crlfDelay: Infinity
    });

    let isFirstJunior = true;
    let juniorFteTotal = 0;
    let unmatchedJunior = 0;

    for await (const line of juniorRl) {
        if (!line.trim()) continue;
        const cols = parseCsvLine(line);
        if (isFirstJunior) {
            isFirstJunior = false;
            continue;
        }

        const unit = cols[2];
        const reportingSenior = cols[3];
        const grade = cols[4];
        const minPay = parseFloat(cols[5]) || 0;
        const maxPay = parseFloat(cols[6]) || 0;
        const genericTitle = cols[7];
        const fteStr = cols[8];
        const profession = cols[9];
        const region = cols[10];

        let fteVal = 0;
        if (fteStr === '<5') {
            fteVal = 2.0; // Standard census privacy approximation
        } else {
            fteVal = parseFloat(fteStr) || 0;
        }
        juniorFteTotal += fteVal;

        const juniorObj = {
            grade,
            minPay,
            maxPay,
            title: genericTitle,
            fte: fteVal,
            profession: profession || 'Other',
            region: region || 'Unknown'
        };

        if (seniorMap[reportingSenior]) {
            seniorMap[reportingSenior].juniorReports.push(juniorObj);
        } else {
            unmatchedJunior++;
        }
    }

    console.log(`Associated junior rows. Est. Junior FTE: ${juniorFteTotal.toFixed(1)}`);
    if (unmatchedJunior > 0) {
        console.warn(`Warning: Found ${unmatchedJunior} junior rows with unmatched senior post.`);
    }

    // 3. Assemble Hierarchical Tree
    let root = null;
    const treeRoots = [];

    for (const id in seniorMap) {
        const post = seniorMap[id];
        const reportsTo = post.reportsTo;

        if (reportsTo === 'XX' || reportsTo === 'N/A' || !reportsTo || reportsTo === id) {
            treeRoots.push(post);
        } else {
            const parent = seniorMap[reportsTo];
            if (parent) {
                parent.children.push(post);
            } else {
                // Orphaned senior post reporting to missing senior reference -> treat as root
                treeRoots.push(post);
            }
        }
    }

    // Set the main root
    if (treeRoots.length > 0) {
        // Prefer OD101 if present, otherwise first root
        root = treeRoots.find(r => r.id === 'OD101') || treeRoots[0];
        console.log(`Resolved root post: ${root.id} (${root.names.join('/')} - ${root.jobTitles.join('/')})`);
    } else {
        throw new Error("Could not find any root posts!");
    }

    // 4. Recursive Rollup Calculations
    function computeRollups(node) {
        let rollupFte = node.fte;
        let directJuniorFte = 0;

        // Maps to aggregate descendant distributions
        const regionsMap = {};
        const professionsMap = {};
        const gradesMap = {};

        // Self regional/professional details
        const selfRegion = node.regions[0] || 'Unknown';
        const selfProfession = node.professions[0] || 'Other';
        const selfGrade = node.grades[0] || 'SCS';

        regionsMap[selfRegion] = (regionsMap[selfRegion] || 0) + node.fte;
        professionsMap[selfProfession] = (professionsMap[selfProfession] || 0) + node.fte;
        gradesMap[selfGrade] = (gradesMap[selfGrade] || 0) + node.fte;

        // Direct junior reports metrics
        node.juniorReports.forEach(j => {
            directJuniorFte += j.fte;
            rollupFte += j.fte;

            regionsMap[j.region] = (regionsMap[j.region] || 0) + j.fte;
            professionsMap[j.profession] = (professionsMap[j.profession] || 0) + j.fte;
            gradesMap[j.grade] = (gradesMap[j.grade] || 0) + j.fte;
        });

        // Compute recursively for children
        node.children.forEach(child => {
            const childRollup = computeRollups(child);
            rollupFte += childRollup.rollupFte;

            // Merge child distributions
            for (const r in childRollup.regionsMap) {
                regionsMap[r] = (regionsMap[r] || 0) + childRollup.regionsMap[r];
            }
            for (const p in childRollup.professionsMap) {
                professionsMap[p] = (professionsMap[p] || 0) + childRollup.professionsMap[p];
            }
            for (const g in childRollup.gradesMap) {
                gradesMap[g] = (gradesMap[g] || 0) + childRollup.gradesMap[g];
            }
        });

        // Attach computed metrics to the node
        node.directJuniorFte = parseFloat(directJuniorFte.toFixed(1));
        node.rollupFte = parseFloat(rollupFte.toFixed(1));
        node.regionsMap = regionsMap;
        node.professionsMap = professionsMap;
        node.gradesMap = gradesMap;

        return {
            rollupFte,
            regionsMap,
            professionsMap,
            gradesMap
        };
    }

    // Run rollup computation starting at the root
    computeRollups(root);

    // 5. Build static assets public folder if not exists and write JSON
    const publicDir = path.join(workspaceDir, 'public');
    if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
    }

    const outputPath = path.join(publicDir, 'hmrc-data.json');
    fs.writeFileSync(outputPath, JSON.stringify(root), 'utf8');
    console.log(`Successfully generated tree data JSON!`);
    console.log(`Path: ${outputPath}`);
    console.log(`Size: ${(fs.statSync(outputPath).size / 1024).toFixed(1)} KB`);
    console.log(`Root total rollup FTE: ${root.rollupFte.toFixed(1)}`);
}

preprocess().catch(err => {
    console.error("Preprocessor failed:", err);
    process.exit(1);
});
