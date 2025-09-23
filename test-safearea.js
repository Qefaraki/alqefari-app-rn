// Test file to check SafeAreaView imports
const fs = require('fs');
const path = require('path');

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  let inReactNativeImport = false;
  let reactNativeImportLine = -1;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if we're starting a react-native import
    if (line.includes('from "react-native"') || line.includes("from 'react-native'")) {
      // Check if SafeAreaView is on this line
      if (line.includes('SafeAreaView')) {
        console.log(`FOUND: ${filePath}:${i + 1} - SafeAreaView imported from react-native`);
        console.log(`  Line: ${line.trim()}`);
      }
      inReactNativeImport = false;
    } else if (line.includes('} from "react-native"') || line.includes("} from 'react-native'")) {
      // End of multiline import
      inReactNativeImport = false;
    } else if (inReactNativeImport && line.includes('SafeAreaView')) {
      console.log(`FOUND: ${filePath}:${i + 1} - SafeAreaView in react-native import block`);
      console.log(`  Line: ${line.trim()}`);
    } else if (line.includes('import') && line.includes('{')) {
      // Start of multiline import
      if (lines.slice(i).join(' ').includes('from "react-native"') || 
          lines.slice(i).join(' ').includes("from 'react-native'")) {
        inReactNativeImport = true;
        reactNativeImportLine = i;
      }
    }
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      if (!file.startsWith('.') && file !== 'node_modules') {
        walkDir(filePath);
      }
    } else if (file.endsWith('.js') || file.endsWith('.jsx') || file.endsWith('.ts') || file.endsWith('.tsx')) {
      checkFile(filePath);
    }
  }
}

console.log('Checking for SafeAreaView imports from react-native...\n');
walkDir('./src');
walkDir('./');
