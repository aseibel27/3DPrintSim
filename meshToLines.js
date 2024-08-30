import * as THREE from 'three';

// Enum for triangle intersection type
const TriIntersectType = {
    NO_INTERSECTION: 0,
    NO_PLANAR_VERTICES: 1,
    ONE_PLANAR_VERTEX: 2,
    TWO_PLANAR_VERTICES: 3,
    THREE_PLANAR_VERTICES: 4
};

// Custom object constructor function for vertex pair
export class VertexPair {
    constructor(v0, v1) {
        this.v0 = v0;
        this.v1 = v1;
    }
}
    
function analyzeTriangle(triangle, z) {
    let above = 0;
    let below = 0;
    let equal = 0;

    // Iterate through the vertices of the triangle
    for (let i = 0; i < 3; i++) {
        const vertexZ = triangle[i].z;

        if (vertexZ > z) {
            above++;
        } else if (vertexZ === z) {
            equal++;
        } else if (vertexZ < z) {
            below++;
        }
    }

    return { above, equal, below };
}

function getTriIntersectType(above, equal, below) {
    let intersectType = TriIntersectType.NO_INTERSECTION;

    if (above >= 1 && below >= 1) {
        if (equal === 1) {
            intersectType = TriIntersectType.ONE_PLANAR_VERTEX;
        }
        else {
            intersectType = TriIntersectType.NO_PLANAR_VERTICES;
        }
    }
    if (equal === 2) {
        intersectType |= TriIntersectType.TWO_PLANAR_VERTICES;
    }
    if (equal === 3) {
        intersectType |= TriIntersectType.THREE_PLANAR_VERTICES;
    }

    return intersectType;
}

function addPlanarIntersection(triangle, z, intersectType, planarVertexPairs) {
    const [v0, v1, v2] = triangle;

    const getIntersectionPoint = (p0, p1, z) => {
        const t = (z - p0.z) / (p1.z - p0.z);
        return new THREE.Vector3(
            p0.x + t * (p1.x - p0.x),
            p0.y + t * (p1.y - p0.y),
            z
        );
    };

    if (intersectType === TriIntersectType.NO_PLANAR_VERTICES || intersectType === TriIntersectType.ONE_PLANAR_VERTEX) {
        const points = [];

        [[v0, v1], [v1, v2], [v2, v0]].forEach(([p0, p1]) => {
            if ((z > p0.z && z < p1.z) || (z > p1.z && z < p0.z)) {
                points.push(getIntersectionPoint(p0, p1, z));
            }
        });

        if (points.length === 2) {
            planarVertexPairs.push(new VertexPair(points[0], points[1]));
        }

    } 
    else if (intersectType === TriIntersectType.TWO_PLANAR_VERTICES) {
        [[v0, v1], [v1, v2], [v2, v0]].forEach(([p0, p1]) => {
            if (p0.z === p1.z) {
                planarVertexPairs.push(new VertexPair(
                    new THREE.Vector3(p0.x, p0.y, z),
                    new THREE.Vector3(p1.x, p1.y, z)
                ));
            }
        });
    }
    
    return planarVertexPairs;
}

export function sliceMesh(mesh, zRes) {
    // extract triangles from mesh into array
    const triangles = extractTrianglesFromGeom(mesh.geometry);

    // Get min and max z values of mesh
    const { minZ, maxZ } = getMinMaxZ(mesh);
    console.log('minmax',minZ,maxZ);

    // For each slice, consider each triangle, find intersecting line segment, and add segment to list. 
    // After going through all triangles, sort the list of segments to construct continuous polygons and combine colinear segments
    var sortedPairs = [];
    let z = 0.0;
    for (z = minZ; z <= maxZ; z += zRes) {
        //  initialize array to store line segments from current plane
        var planarVertexPairs = [];
        console.log('minZ:',minZ);
        console.log('maxZ:',maxZ);
        console.log('slice zRes:', zRes)
        console.log('z',z);

        // iterate through each triangle
        for (let i = 0; i < triangles.length; i++){
            // convert triangle vertices from local to world coordinates
            let tri = convertTriangleToWorld(triangles[i], mesh);

            // find triangles intersection type with current z plane
            const {above, equal, below} = analyzeTriangle(tri, z); // num or triangle vertices above, equal, or below current z plane
            const intersectType = getTriIntersectType(above, equal, below);

            // add intersecting line segment to list
            planarVertexPairs = addPlanarIntersection(tri, z, intersectType, planarVertexPairs)
        }
        console.log('sortedPairsLength',sortedPairs.length);
        let lastPosition;
        if (sortedPairs.length > 0) {
            lastPosition = sortedPairs[sortedPairs.length-1].v1;
        }
        else {
            console.log('sortedPairs has no length');
            const zero = new THREE.Vector3(0,0,0);
            lastPosition = zero;
        }

        // sort line segments for current z plane into continuous polygon, combining colinear segments
        console.log('numPlanarLines',planarVertexPairs.length);
        planarVertexPairs = sortVertexPairs(planarVertexPairs, lastPosition);
        console.log('z, num sorted lines', z, planarVertexPairs.length);

        // add sorted segments from current z plane to growing list of sorted segments
        // console.log('length', planarVertexPairs.length);
        if (planarVertexPairs.length > 2) { // needs at least 3 for polygon
            for (let i = 0; i < planarVertexPairs.length; i++) {
                sortedPairs.push(planarVertexPairs[i]);
            }
        }

    }

    return sortedPairs;
}

// Function to convert local coordinates to world coordinates for each vertex in a triangle
function convertTriangleToWorld(triangle, mesh) {
    const worldTriangle = triangle.map(vertex => {
        // Convert local coordinates to world coordinates
        return vertex.clone().applyMatrix4(mesh.matrixWorld);
    });
    return worldTriangle;
}

function getMinMaxZ(mesh) {
    // Get the geometry and position of the mesh
    const geometry = mesh.geometry;
    // const position = mesh.position;

    // Get the position attribute of the geometry
    const positionAttr = geometry.attributes.position;

    // Initialize variables to store the minimum and maximum z-coordinates
    let minZ = Infinity;
    let maxZ = -Infinity;

    // Iterate over all vertices to find the minimum and maximum z-coordinates
    for (let i = 0; i < positionAttr.count; i++) {
        // Get the local z-coordinate of the current vertex
        // const localZ = positionAttr.getZ(i);

        // Convert the local vertex position to world coordinates
        const worldPosition = new THREE.Vector3();
        worldPosition.fromBufferAttribute(positionAttr, i);
        mesh.localToWorld(worldPosition);

        // Update the minimum and maximum z-coordinates based on world z-coordinate
        minZ = Math.min(minZ, worldPosition.z);
        maxZ = Math.max(maxZ, worldPosition.z);
    }

    // Return an object with minZ and maxZ properties
    return { minZ, maxZ };
}

function extractTrianglesFromGeom(geometry) {
    // const nonIndexedGeometry = geometry.toNonIndexed();
    const nonIndexedGeometry = geometry;
    const positionAttr = nonIndexedGeometry.getAttribute('position');

    if (!positionAttr) {
        console.error("Position attribute is missing");
        return [];
    }

    const triangles = [];

    // Function to get vertex position as a THREE.Vector3
    function getVertexPosition(index) {
        return new THREE.Vector3(
            positionAttr.getX(index),
            positionAttr.getY(index),
            positionAttr.getZ(index)
        );
    }

    // If geometry is not indexed
    for (let i = 0; i < positionAttr.count; i += 3) {
        const v1 = getVertexPosition(i);
        const v2 = getVertexPosition(i + 1);
        const v3 = getVertexPosition(i + 2);
        triangles.push([v1, v2, v3]);

        // console.log('Triangle', i / 3, 'Vertices:', v1, v2, v3);
    }

    return triangles;
}

function distanceToReference(vertex, reference) {
    // console.log('vertex',vertex);
    // const distance = vertex.distanceTo(reference);
    return Math.sqrt(vertex.x * vertex.x + vertex.y * vertex.y + vertex.z * vertex.z);
    // return distance;
}

function findClosestSegment(vertexPairs, reference) {
    let minDistance = Infinity;
    let startSegmentIndex = -1;
    let value = true; // true if does not need flipped (distA < distB)
 
    vertexPairs.forEach((pair, index) => {
        const distA = distanceToReference(pair.v0, reference);
        const distB = distanceToReference(pair.v1, reference);

        if (distA < minDistance || distB < minDistance) {
            minDistance = Math.min(distA, distB);
            startSegmentIndex = index;
            if (distA > distB) { value = false; }
        }
    });

    return { index: startSegmentIndex, flip: value };
}

THREE.Vector3.prototype.equalsWithinTolerance = function (other, tolerance = 1e-10) {
    return (
        Math.abs(this.x - other.x) < tolerance &&
        Math.abs(this.y - other.y) < tolerance &&
        Math.abs(this.z - other.z) < tolerance
    );
};

function sortVertexPairs(vertexPairs, lastPair) {
    
    // Helper function to check if three points are collinear
    function areCollinear(segment1, segment2) {
        let v1 = segment1.v0;
        let v2 = segment1.v1;
        let v3 = segment2.v0;
        let v4 = segment2.v1;
        const crossProduct = new THREE.Vector3()
            .subVectors(v2, v1)
            .cross(new THREE.Vector3().subVectors(v4, v3));
        return crossProduct.lengthSq() < 1e-10; // Consider it zero if the cross product is very small
    }

    // const zero = new THREE.Vector3(0,0,0);
    // let reference = zero;
    const sortedPairs = [];
    
    // Find the starting segment
    console.log('number of vertex pairs',vertexPairs.length);
    const closestSegmentInfo = findClosestSegment(vertexPairs, lastPair); // get index of vertex closest to origin
    let startIndex = closestSegmentInfo.index;
    let myValue = closestSegmentInfo.flip;
    let firstPair = vertexPairs[startIndex];

    if (myValue) {
        sortedPairs.push(vertexPairs[startIndex]);
    }
    else {
        [firstPair.v0, firstPair.v1] = [firstPair.v1, firstPair.v0];
        sortedPairs.push(firstPair);
    }
    
    
    // Remove the starting segment from the list
    vertexPairs.splice(startIndex, 1);
    
    // Continue sorting the rest of the pairs
    while (vertexPairs.length > 0) {
        // console.log('vertex, sorted', vertexPairs.length, sortedPairs.length);
        const lastPair = sortedPairs[sortedPairs.length - 1];
        let foundIndex = -1;

        for (let i = 0; i < vertexPairs.length; i++) {
            const pair = vertexPairs[i];

            if (lastPair.v1.equalsWithinTolerance(pair.v0)) {
                foundIndex = i;
                break;
            } 
            else if (lastPair.v1.equalsWithinTolerance(pair.v1)) {
                // Swap vertices if necessary
                [pair.v0, pair.v1] = [pair.v1, pair.v0];
                foundIndex = i;
                break;
            }
        }

        if (foundIndex !== -1) {
            if(areCollinear(lastPair, vertexPairs[foundIndex])) {
                sortedPairs[sortedPairs.length - 1].v1 = vertexPairs[foundIndex].v1;
                vertexPairs.splice(foundIndex, 1);
            }
            else {
                sortedPairs.push(vertexPairs[foundIndex]);
                vertexPairs.splice(foundIndex, 1);
            }
        }
        else {
            // console.error("Segments are not properly connected.");
            console.log("new polygon");
            const newClosestSegmentInfo = findClosestSegment(vertexPairs, sortedPairs[sortedPairs.length - 1]);
            let newStartIndex = newClosestSegmentInfo.index;
            let newValue = closestSegmentInfo.flip;
            let newFirstPair = vertexPairs[newStartIndex];
        
            if (newValue) {
                sortedPairs.push(vertexPairs[newStartIndex]);
            }
            else {
                [newFirstPair.v0, newFirstPair.v1] = [newFirstPair.v1, newFirstPair.v0];
                sortedPairs.push(newFirstPair);
            }
            // break;
        }
    }

    return sortedPairs;
}