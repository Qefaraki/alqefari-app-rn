const d3 = require('d3-shape');
const {Skia} = require('@shopify/react-native-skia');

// Test 1: Generate curveStepBefore path with d3.link
const linkWithStepBefore = d3.link(d3.curveStepBefore);
linkWithStepBefore.x(d => d.y);
linkWithStepBefore.y(d => d.x);
const svg = linkWithStepBefore({source: {x: 150, y: 100}, target: {x: 300, y: 400}});
console.log('SVG path:', svg);

// Test 2: Try to create Skia path from it
const skiaPath = Skia.Path.MakeFromSVGString(svg);
console.log('Skia path created:', skiaPath !== null);

if (skiaPath) {
  console.log('Path bounds:', JSON.stringify(skiaPath.getBounds()));
  console.log('SUCCESS: Skia can parse curveStepBefore paths!');
} else {
  console.log('FAILURE: Skia cannot parse curveStepBefore paths');
}
