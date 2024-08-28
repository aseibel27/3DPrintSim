import {setupMainScene, setupOverlayScene, loadNozzle} from './setupScene.js';
import {VertexPair, sliceMesh} from './meshToLines.js';
import * as THREE from 'three';
// import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';

// Add event listeners for buttons
document.getElementById('loadFile').addEventListener('click', loadFile);
document.getElementById('newGCode').addEventListener('click', newGCodeClick);
document.getElementById('resetPrint').addEventListener('click', resetPrint);
document.getElementById('startPrint').addEventListener('click', startPrint);
document.getElementById('startPrint').addEventListener('click', pausePrint);

// Add event listeners for update fields
document.getElementById('moveSpeedInput').addEventListener('input', updateMoveSpeed);
document.getElementById('printSpeedInput').addEventListener('input', updatePrintSpeed);
document.getElementById('nozzleDiameter').addEventListener('input', updateNozzleDiameter);
document.getElementById('layerHeight').addEventListener('input', updateLayerHeight);
document.getElementById('zRes').addEventListener('input', updateZResolution);

// JavaScript to Handle Color Selection
const colorSelector = document.getElementById('colorSelector');
const colorDisplay = document.getElementById('selectedColorDisplay');
colorDisplay.style.backgroundColor = colorSelector.value;

colorSelector.addEventListener('change', function() {
    const selectedColor = this.value;
    colorDisplay.style.backgroundColor = selectedColor;

    // Optional: Log the selected color to the console
    console.log('Selected color:', selectedColor);
});

// Initialize global variables;
var printColor = "#FF0000"; //red
var stlFile = "";

var printSpeed = 500;
var moveSpeed = 500;
var nozzleDiam = 0.4;
var layerHeight = 0.2;
var zRes = 3;

var curLayer;
var curMove = 0;
var curExtruded = 0;
var curPosition = new THREE.Vector3(0,0,0);

// Call setupMainScene can setupOverlayScene to initialize the scene and overlay scene
const { scene, camera, renderer, controls } = setupMainScene();
const { overlayScene, overlayCamera, overlayRenderer, overlayControls, overlayGridHelper } = setupOverlayScene();

// Update UI fields
document.getElementById('colorSelector').selectedIndex = 1; // 1st index is red
document.getElementById('selectedColorDisplay').style.backgroundColor = printColor;

document.getElementById('printSpeedInput').value = printSpeed;
document.getElementById('moveSpeedInput').value = moveSpeed;
document.getElementById('nozzleDiameter').value = nozzleDiam;
document.getElementById('layerHeight').value = layerHeight;
document.getElementById('zRes').value = zRes;

document.getElementById('extrusionCounterDisplay').textContent = curExtruded;
document.getElementById('nozzleX').textContent = curPosition.x.toFixed(3);
document.getElementById('nozzleY').textContent = curPosition.y.toFixed(3);
document.getElementById('nozzleZ').textContent = curPosition.z.toFixed(3);

async function mainFunction() {
    // Load nozzle onto scene
    const nozzleHeight = 10;
    let cone = loadNozzle(curPosition, nozzleHeight); 
    scene.add(cone);   
    
    // Load mesh from file
    let myMesh = await loadFile('XYZcube.stl');

    // Convert mesh to list of line segments
    var sortedPairs = sliceMesh(myMesh, zRes);
    console.log('sorted pairs', sortedPairs);

    // Convert line of segments into list of moves
    const listOfMoves = [];
    const arrayOfObjects = [];
    for (let i = 0; i < sortedPairs.length; i++) {
        if (!curPosition.equals(sortedPairs[i].v0)) {
            // Add the move to listOfMoves and create a corresponding object
            addMoveAndObject(curPosition, sortedPairs[i].v0, 500, false);
            curPosition = sortedPairs[i].v0;
        }
        // Add the sorted pair to listOfMoves and create a corresponding object
        addMoveAndObject(sortedPairs[i].v0, sortedPairs[i].v1, 500, true);
        curPosition = sortedPairs[i].v1;
    }

    function addMoveAndObject(start, end, speed, fill) {
        listOfMoves.push(new VertexPair(start, end));
        arrayOfObjects.push({
            startPosition: start,
            endPosition: end,
            speed: speed,
            fill: fill
        });
    }
    console.log('list of moves', listOfMoves);
    console.log('array of objects', arrayOfObjects);

    var stopAnimation = false;

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
        const ovalCylinder = createOvalCylinder(nozzleDiam, layerHeight, 0, 32, printColor); // Oval cylinder with radiusX, radiusY, height, segments, and color

        // Create cylinder material
        const printMaterial = new THREE.MeshBasicMaterial({ color: printColor }); // Set the color as desired

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
                cone.position.copy(new THREE.Vector3().addVectors(endPosition, new THREE.Vector3(0,0,nozzleHeight/2))); // TODO: make this less forced (e.g. translate fractional amount)
                stopAnimation = true; 
            }

            if (fill) { // If fill, draw a cylinder
                let startPrintPosition = new THREE.Vector3().subVectors(startPosition, new THREE.Vector3(0,0,layerHeight/2));
                let endPrintPosition = new THREE.Vector3().subVectors(cone.position, new THREE.Vector3(0,0,nozzleHeight/2+layerHeight/2));
                let midpoint = new THREE.Vector3().addVectors(startPrintPosition, endPrintPosition).multiplyScalar(0.5);
                // midpoint = new THREE.Vector3().subVectors(midpoint, new THREE.Vector3(0, 0, 0.1)); // Offset from nozzle tip
                // console.log(midpoint);
                let distancePartial = startPrintPosition.distanceTo(endPrintPosition);

                // Create a new cylinder geometry with the same radius and the new length
                cylinder.geometry.dispose();   
                const newGeometry = new THREE.CylinderGeometry(printRadius, printRadius, distancePartial, 32);
                cylinder.geometry = newGeometry;

                // Create a new cylinder geometry with the same radius and the new length
                updateOvalCylinderGeometry(ovalCylinder, nozzleDiam, layerHeight, distancePartial, 32);
                
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

}
mainFunction();

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

// Function to handle button click event
async function loadFile(filePath) {
    
    // helper function to center mesh on grid
    function centerObject(mesh, overlayGridHelper) {
        // Calculate the bounding box of the loaded geometry
        const bbox = new THREE.Box3().setFromObject(mesh);

        // Calculate the offset to align the bottom with z=0 and center it in x and y directions
        const distX = mesh.position.x - bbox.min.x;
        const distY = mesh.position.y - bbox.min.y;
        const distZ = mesh.position.z - bbox.min.z;;
        const offsetX = -(bbox.max.x - bbox.min.x)/2 + distX + overlayGridHelper.position.x; // Half of the width
        const offsetY = -(bbox.max.y - bbox.min.y)/2 + distY + overlayGridHelper.position.y; // Half of the height
        const offsetZ = -bbox.min.z; // Bottom position

        // Apply the offset to the mesh's position and add to overlay scene
        mesh.position.set(offsetX, offsetY, offsetZ);
    }

    document.getElementById('loadFile').value = filePath;
    const loader = new STLLoader();
    try {
        // Wait for the STL file to be fully loaded
        console.log('Loaded STL file:', filePath);
        const geometry = await loader.loadAsync(filePath);
        
        // load mesh into overlay scene
        geometry.scale(5,5,5);
        geometry.rotateZ(Math.PI/4);
        const material = new THREE.MeshBasicMaterial({ color: 0xff5533 });
        const mesh = new THREE.Mesh(geometry, material);
        centerObject(mesh, overlayGridHelper);
        overlayScene.add(mesh);

        // return geometry to main script
        return mesh;
    } catch (error) {
        console.error('Error loading STL file:', error);
        throw error;
    }


}

function newGCodeClick() {
    // gCodeArray = [';G-code:\n'];
    // generateGCode(drawingMat);
}

async function resetPrint() {
    // resetFlag = true;
    // extrusionCounter = 0;
    // document.getElementById('extrusionCounterDisplay').textContent = extrusionCounter.toFixed(2);
    // await delay(100);
    // printedMat = generateEmptyMatrix(matrixSizeX, matrixSizeY);
    // drawGrid(ctx2, printedMat, squareSize, "white", "black");
    // ctx2.drawImage(img, margin + nozzleLocation[0]-nozzleSizeX/2, margin + 400 - nozzleLocation[1]-nozzleSizeY-squareSize, nozzleSizeX, nozzleSizeY); // Specify the position and size of the image
}

async function startPrint() {
    // printError("Starting print");
    // resetFlag = true;
    // extrusionCounter = 0;
    // document.getElementById('extrusionCounterDisplay').textContent = extrusionCounter.toFixed(2);
    // await delay(100);
    // resetFlag = false;

    // // Retrieve G-code at current line
    // let row = 1;
    // let gcode1 = getGCodeLine(row);

    // // Read current line of G-code, change values accordingly
    // handleGCode(gcode1);

    // // Move nozzle according to g-code
    // movePictureX(ctx2, row);

}

function pausePrint() {

}

function updateMoveSpeed() {

}

function updatePrintSpeed() {

}

function updateNozzleDiameter() {

}

function updateLayerHeight() {

}

function updateZResolution() {

}
