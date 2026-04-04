const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const targetPropertiesPath = path.join(__dirname, 'android', 'local.properties');
const sourcePropertiesPath = path.join('C:', 'Users', 'amiba', 'Projects', 'poultry-solution', 'android', 'local.properties');

const stagingDir = path.join(__dirname, 'android-src-staging');
const javaBaseDir = path.join(__dirname, 'android', 'app', 'src', 'main', 'java', 'com', 'securesms');

function copyRecursiveSync(src, dest) {
    const exists = fs.existsSync(src);
    const stats = exists && fs.statSync(src);
    const isDirectory = exists && stats.isDirectory();
    if (isDirectory) {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }
        fs.readdirSync(src).forEach((childItemName) => {
            copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
        });
    } else {
        fs.copyFileSync(src, dest);
    }
}

function ensurePrebuild() {
    console.log('--- Running Prebuild Checks ---');

    const args = process.argv.slice(2);
    const isClean = args.includes('--clean');

    if (isClean) {
        console.log('Running npx expo prebuild --clean...');
        try {
            execSync('npx expo prebuild --clean', { stdio: 'inherit' });
            console.log('✅ Expo prebuild --clean completed.');
        } catch (err) {
            console.error(`❌ Expo prebuild failed: ${err.message}`);
        }
    }

    // 1. Sync local.properties
    if (!fs.existsSync(targetPropertiesPath)) {
        if (fs.existsSync(sourcePropertiesPath)) {
            console.log(`Copying local.properties from poultry-solution...`);
            fs.mkdirSync(path.dirname(targetPropertiesPath), { recursive: true });
            fs.copyFileSync(sourcePropertiesPath, targetPropertiesPath);
            console.log('✅ Successfully copied local.properties');
        }
    } else {
        console.log('✅ local.properties already exists.');
    }

    // 2. Sync custom modules from staging
    if (fs.existsSync(stagingDir)) {
        console.log(`Syncing files from ${stagingDir} to ${javaBaseDir}...`);
        try {
            copyRecursiveSync(stagingDir, javaBaseDir);
            console.log('✅ Successfully synced custom modules.');
        } catch (err) {
            console.error(`❌ Failed to sync custom modules: ${err.message}`);
        }
    }
    
    console.log('--- Prebuild Checks Complete ---');
}

ensurePrebuild();
