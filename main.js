import {setupMainScene, setupOverlayScene} from './setupScene.js';
import {VertexPair, sliceMesh} from './meshToLines.js';
import * as THREE from 'three';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { BufferGeometry } from 'three';

// Call setupMainScene can setupOverlayScene to initialize the scene and overlay scene
const { scene, camera, renderer, controls } = setupMainScene();
const { overlayScene, overlayCamera, overlayRenderer, overlayControls, overlayGridHelper } = setupOverlayScene();

// ******** random 3d object ******** //

// Add objects to the scene
const cubeSize = 100;
const geometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const cube = new THREE.Mesh(geometry, material);

// Calculate the bounding box of the loaded geometry
const bbox = new THREE.Box3().setFromObject(cube);

// Calculate the offset to align the bottom with z=0 and center it in x and y directions
const distX = cube.position.x - bbox.min.x;
const distY = cube.position.y - bbox.min.y;
const distZ = cube.position.z - bbox.min.z;;
const offsetX = -(bbox.max.x - bbox.min.x)/2 + distX + overlayGridHelper.position.x; // Half of the width
const offsetY = -(bbox.max.y - bbox.min.y)/2 + distY + overlayGridHelper.position.y; // Half of the height
const offsetZ = -bbox.min.z; // Bottom position


// Apply the offset to the mesh's position and add to overlay scene
cube.position.set(offsetX, offsetY, offsetZ);
overlayScene.add(cube);

// Convert mesh to list of line segments
const zRes = 3;
var sortedPairs = sliceMesh(cube, zRes);
console.log('sorted pairs', sortedPairs);

// ******** random 3d object ******** //

function createOvalCylinder(radiusX, radiusY, height, segments, color) {
    // Create a custom shape for the oval cross-section
    const shape = new THREE.Shape();
    // shape.moveTo(radiusX, 0);
    shape.ellipse(0, 0, radiusX, radiusY, 0, Math.PI * 2, false);

    // Extrude the shape to create the cylinder geometry
    const extrudeSettings = {
        steps: segments, // Number of segments
        depth: height,
        bevelEnabled: false
    };

    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    // Rotate the geometry to orient the height along the x-axis
    geometry.rotateX(-Math.PI / 2); // Rotate 90 degrees around y-axis

    // Create a material
    const material = new THREE.MeshBasicMaterial({ color: color });

    // Create the mesh and return it
    const mesh = new THREE.Mesh(geometry, material);
    return mesh;
}

function updateOvalCylinderGeometry(mesh, radiusX, radiusY, height, segments) {
    // Create a new custom shape for the oval cross-section
    const shape = new THREE.Shape();
    // shape.moveTo(radiusX, 0);
    shape.ellipse(0, 0, radiusX, radiusY, 0, Math.PI * 2, false);

    // Extrude the new shape to create the updated cylinder geometry
    const extrudeSettings = {
        steps: segments,
        depth: height,
        bevelEnabled: false
    };

    const newGeometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    // Rotate the geometry to orient the height along the x-axis (TODO fix so always correct orientation)
    newGeometry.rotateX(-Math.PI / 2); // Rotate 90 degrees around y-axis

    // Update the mesh's geometry with the new geometry
    mesh.geometry.dispose(); // Dispose old geometry to release memory
    mesh.geometry = newGeometry;
}

// Example usage:
// const ovalCylinder = createOvalCylinder(5, 2, 10, 32, 0xff0000); // Oval cylinder with radiusX, radiusY, height, segments, and color
// scene.add(ovalCylinder);

// Define the parameters for the cone
const radius = 5; // Base radius of the cone
const height = 10; // Height of the cone
const radialSegments = 32; // Number of segments around the circumference
const heightSegments = 1; // Number of segments along the height
const openEnded = false; // Whether the cone is open-ended

// Define the position for the cone
const position = new THREE.Vector3(0.2, 0.2, 0.2+height/2);

// Create the geometry for the cone
const coneGeometry = new THREE.ConeGeometry(radius, height, radialSegments, heightSegments, openEnded).rotateX(-Math.PI/2);

// Create a material for the cone
const coneMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff , transparent: true, opacity: 0.3 }); // Set the color as desired

// Create the mesh for the cone
const cone = new THREE.Mesh(coneGeometry, coneMaterial);

// Position the cone at the specified coordinates
cone.position.copy(position);

// Add the cone to the scene
scene.add(cone);

// Combine the arrays into a list
// const arrayOfObjects = [
//     { startPosition: new THREE.Vector3(0.2, 0.2, 0.2), endPosition: new THREE.Vector3(219.8, 0.2, 219.8), speed: 100 , fill: true},
//     { startPosition: new THREE.Vector3(219.8, 0.2, 219.8), endPosition: new THREE.Vector3(219.8, 219.8, 0.2), speed: 200 , fill: true},
//     { startPosition: new THREE.Vector3(219.8, 219.8, 0.2), endPosition: new THREE.Vector3(0.2, 219.8, 0.2), speed: 100, fill: true},
//     { startPosition: new THREE.Vector3(0.2, 219.8, 0.2), endPosition: new THREE.Vector3(0.2, 0.2, 0.2), speed: 200, fill: true},
//     // Add more objects as needed
// ];

const arrayOfObjects = [];
for (let i = 0; i < sortedPairs.length; i++) {
    const singleVertexPair = sortedPairs[i];

    // Create an object with startPosition, endPosition, speed, and fill
    const obj = {
        startPosition: singleVertexPair.v0, // Use v0 as startPosition
        endPosition: singleVertexPair.v1,   // Use v1 as endPosition
        speed: 200,         // Example: increment speed for each object
        fill: true                    // Set fill to true
    };

    // Add the object to the array
    arrayOfObjects.push(obj);
}

// Function to create lines for each array
function createLines(start, stop) {
    const points = [start, stop];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0x00ff00 }); // Set the color as desired
    const line = new THREE.Line(geometry, material);
    scene.add(line);
}

// Create lines for each array
arrayOfObjects.forEach(array => {
    createLines(array.startPosition, array.endPosition);
});

var stopAnimation = false;
var resXY = 0.4; // mm
var resZ = 0.2; // mm

// Print animation loop
function continuePrint(row) {

    // Calculate the distance and velocity
    const currentArray = arrayOfObjects[row];
    const startPosition = currentArray.startPosition;
    const endPosition = currentArray.endPosition;
    const speed = currentArray.speed;
    const fill = currentArray.fill;
    const fps = 60;
    const frameSpeed = speed/fps;
    const moveVector = new THREE.Vector3().subVectors(endPosition, startPosition);
    const distanceTotal = startPosition.distanceTo(endPosition);
    const expectedFrames = distanceTotal/frameSpeed;
    
    // Create cylinder geometry
    const printRadius = 0.1; // Set the radius as desired
    const printGeometry = new THREE.CylinderGeometry(printRadius, printRadius, 0, 32);
    const ovalCylinder = createOvalCylinder(resXY, resZ, 0, 32, 0xff0000); // Oval cylinder with radiusX, radiusY, height, segments, and color

    // Create cylinder material
    const printMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // Set the color as desired

    // Create cylinder mesh
    let cylinder = new THREE.Mesh(printGeometry, printMaterial);
    let direction = new THREE.Vector3().subVectors(endPosition, startPosition);
    cylinder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    ovalCylinder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    
    let frame = 0;
    function updatePrintAnimation() {
        // Update the position of the cone by adding the change
        frame++;
        // console.log(cone.position);
        cone.translateX(moveVector.x/expectedFrames);
        cone.translateY(moveVector.y/expectedFrames); 
        cone.translateZ(moveVector.z/expectedFrames);// Move the x and y positions by the speeds

        if (frame > expectedFrames) {
            cone.position.copy(new THREE.Vector3().addVectors(endPosition, new THREE.Vector3(0,0,height/2))); // TODO: make this less forced (e.g. translate fractional amount)
            stopAnimation = true; 
        }

        if (fill) { // If fill, draw a cylinder
            let startPrintPosition = new THREE.Vector3().subVectors(startPosition, new THREE.Vector3(0,0,resZ/2));
            let endPrintPosition = new THREE.Vector3().subVectors(cone.position, new THREE.Vector3(0,0,height/2+resZ/2));
            let midpoint = new THREE.Vector3().addVectors(startPrintPosition, endPrintPosition).multiplyScalar(0.5);
            // midpoint = new THREE.Vector3().subVectors(midpoint, new THREE.Vector3(0, 0, 0.1)); // Offset from nozzle tip
            // console.log(midpoint);
            let distancePartial = startPrintPosition.distanceTo(endPrintPosition);

            // Create a new cylinder geometry with the same radius and the new length
            cylinder.geometry.dispose();   
            const newGeometry = new THREE.CylinderGeometry(printRadius, printRadius, distancePartial, 32);
            cylinder.geometry = newGeometry;

            // Create a new cylinder geometry with the same radius and the new length
            updateOvalCylinderGeometry(ovalCylinder, resXY, resZ, distancePartial, 32);
            
            // Position and orient the cylinder
            cylinder.position.copy(midpoint);
            ovalCylinder.position.copy(startPrintPosition);
            // console.log(ovalCylinder.position);

            // Add the cylinder to the scene
            // scene.add(cylinder);
            scene.add(ovalCylinder);
        }

        if (stopAnimation) { // Current move is finished, start next move
            stopAnimation = false;
            row++;         
            if (row < arrayOfObjects.length) {
                continuePrint(row);
            }
        }
        else {
            requestAnimationFrame( updatePrintAnimation );
        }

    }

    updatePrintAnimation();
}

function animateScene() { 
    requestAnimationFrame( animateScene );
    renderer.render( scene, camera );
    overlayRenderer.render(overlayScene, overlayCamera);
    controls.update();
    overlayControls.update();
}

// Start animations
animateScene();
continuePrint(0);