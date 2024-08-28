import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';

export function loadNozzle(curPosition, height) {
    // Define the parameters for the cone
    const radius = 5; // Base radius of the cone
    // const height = 10; // Height of the cone
    const radialSegments = 32; // Number of segments around the circumference
    const heightSegments = 1; // Number of segments along the height
    const openEnded = false; // Whether the cone is open-ended

    // Define the position for the cone
    const position = new THREE.Vector3(curPosition.x+0.2, curPosition.y+0.2, curPosition.z+0.2+height/2);

    // Create the geometry for the cone
    const coneGeometry = new THREE.ConeGeometry(radius, height, radialSegments, heightSegments, openEnded).rotateX(-Math.PI/2);

    // Create a material for the cone
    const coneMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff , transparent: true, opacity: 0.3 }); // Set the color as desired

    // Create the mesh for the cone
    const cone = new THREE.Mesh(coneGeometry, coneMaterial);

    // Position the cone at the specified coordinates
    cone.position.copy(position);

    return cone;
}

export function setupMainScene() {
    // Set up the scene, camera, and renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('mainSceneContainer').appendChild(renderer.domElement);

    // Position the camera
    camera.position.x = 110;
    camera.position.y = -110;
    camera.position.z = 220;

    // Add OrbitControls
    const controls = new OrbitControls( camera, renderer.domElement );
    controls.update();

    // Add XYZ axis helper
    const axesHelper = new THREE.AxesHelper(40); // Size of the axis helper
    scene.add(axesHelper);

    createTextLabel('X', new THREE.Vector3(40, 0, 0), 0xff0000, function(textMeshX) {
        scene.add(textMeshX); // Add to the scene after creation
    });
    createTextLabel('Y', new THREE.Vector3(0, 40, 0), 0x00ff00, function(textMeshY) {
        scene.add(textMeshY); // Add to the scene after creation
    });
    createTextLabel('Z', new THREE.Vector3(0, 0, 40), 0x0000ff, function(textMeshZ) {
        scene.add(textMeshZ); // Add to the scene after creation
    });

    // Create a grid helper
    const gridSize = 220; // Size of the grid
    const gridDivisions = 11; // Number of divisions
    const gridHelper = new THREE.GridHelper(gridSize, gridDivisions);

    // Rotate the grid to align with the XY plane
    gridHelper.rotation.x = Math.PI / 2;

    // Translate the grid helper to position it where x and y are positive from 0 to 220
    gridHelper.position.set(gridSize / 2, gridSize / 2, 0);

    // Add the grid helper to the scene
    scene.add(gridHelper);

    // Set controls target to the center of the grid
    controls.target.set(gridSize / 2, gridSize / 2, 0);

    // Return the scene and camera so they can be used in the main script
    return { scene, camera, renderer, controls };
}

export function setupOverlayScene() {
    // Overlay scene setup
    const overlayScene = new THREE.Scene();
    const overlayCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const overlayRenderer = new THREE.WebGLRenderer();
    overlayRenderer.setSize(window.innerWidth*0.3, window.innerHeight*0.3);
    document.getElementById('overlayScene').appendChild(overlayRenderer.domElement);

    // Toggle visibility of the overlay scene when a toggle button is clicked
    document.addEventListener('DOMContentLoaded', function() {
    
        // Toggle visibility of the container when the button is clicked
        document.getElementById('toggleButton').addEventListener('click', function(event) {
            const content = document.getElementById('overlayScene');
            if (content.style.display === 'none') {
            content.style.display = 'block';
            } else {
            content.style.display = 'none';
            }
            event.stopPropagation(); // Prevent event bubbling to parent elements
        });
    });

    // Position the camera
    overlayCamera.position.x = 110;
    overlayCamera.position.y = -110;
    overlayCamera.position.z = 220;
    
    // Add OrbitControls
    const overlayControls = new OrbitControls( overlayCamera, overlayRenderer.domElement );
    overlayControls.update();

    // Add XYZ axis helper
    const overlayAxesHelper = new THREE.AxesHelper(40); // Size of the axis helper
    overlayScene.add(overlayAxesHelper);

    createTextLabel('X', new THREE.Vector3(40, 0, 0), 0xff0000, function(textMeshX) {
        overlayScene.add(textMeshX); // Add to the scene after creation
    });
    createTextLabel('Y', new THREE.Vector3(0, 40, 0), 0x00ff00, function(textMeshY) {
        overlayScene.add(textMeshY); // Add to the scene after creation
    });
    createTextLabel('Z', new THREE.Vector3(0, 0, 40), 0x0000ff, function(textMeshZ) {
        overlayScene.add(textMeshZ); // Add to the scene after creation
    });

    // Create a grid helper
    const gridSize = 220; // Size of the grid
    const gridDivisions = 11; // Number of divisions
    const overlayGridHelper = new THREE.GridHelper(gridSize, gridDivisions);

    // Rotate the grid to align with the XY plane
    overlayGridHelper.rotation.x = Math.PI / 2;

    // Translate the grid helper to position it where x and y are positive from 0 to 220
    overlayGridHelper.position.set(gridSize / 2, gridSize / 2, 0);

    // Add the grid helper to the scene
    overlayScene.add(overlayGridHelper);

    // Set controls target to the center of the grid
    overlayControls.target.set(gridSize / 2, gridSize / 2, 0);

    // Return the scene and camera so they can be used in the main script
    return { overlayScene, overlayCamera, overlayRenderer, overlayControls, overlayGridHelper };
}

function createTextLabel(text, position, color, callback) {
    const loader = new FontLoader();
    loader.load('https://threejs.org/examples/fonts/helvetiker_regular.typeface.json',
        function ( font ) {
            // do something with the font
            // console.log( font );
            const textGeometry = new TextGeometry(text, {
                font: font,
                size: 10, // Size of the text
                height: 0.2, // Thickness of the text
            });
            const textMaterial = new THREE.MeshBasicMaterial({ color: color });
            const textMesh = new THREE.Mesh(textGeometry, textMaterial);
            textMesh.position.copy(position);
            // return textMesh;

            // Execute the callback with the created textMesh
            callback(textMesh);
        }
    );
}
