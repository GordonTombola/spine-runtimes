/******************************************************************************
 * Spine Runtimes License Agreement
 * Last updated January 1, 2020. Replaces all prior versions.
 *
 * Copyright (c) 2013-2020, Esoteric Software LLC
 *
 * Integration of the Spine Runtimes into software or otherwise creating
 * derivative works of the Spine Runtimes is permitted under the terms and
 * conditions of Section 2 of the Spine Editor License Agreement:
 * http://esotericsoftware.com/spine-editor-license
 *
 * Otherwise, it is permitted to integrate the Spine Runtimes into software
 * or otherwise create derivative works of the Spine Runtimes (collectively,
 * "Products"), provided that each user of the Products must obtain their own
 * Spine Editor license and redistribution of the Products in any form must
 * include this license and copyright notice.
 *
 * THE SPINE RUNTIMES ARE PROVIDED BY ESOTERIC SOFTWARE LLC "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL ESOTERIC SOFTWARE LLC BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES,
 * BUSINESS INTERRUPTION, OR LOSS OF USE, DATA, OR PROFITS) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THE SPINE RUNTIMES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *****************************************************************************/

import { SkeletonMeshMaterial, SkeletonMeshMaterialOptionsCustomizer } from "./SkeletonMesh";
import { ActionManager, Mesh, Scene, VertexData } from "@babylonjs/core";

export interface ISpineVertexData {
    positions: number[];
    indices: number[];
    colors: number[];
    uvs: number[];
}

export class MeshBatcher extends Mesh {

    public depth: number = 0;

    private static VERTEX_SIZE = 9;

    private maxVerticesLength = 0;
    private maxIndicesLength = 0;

    private vertexData: ISpineVertexData = {
        positions: [],
        indices: [],
        colors: [],
        uvs: []
    };

    private verticesLength = 0;
    private indicesLength = 0;

    constructor(name: string, scene: Scene, private materialCustomizer: SkeletonMeshMaterialOptionsCustomizer = () => { }, maxVertices: number = 10920) {
        super(name, scene);
        if (maxVertices > 10920) throw new Error("Can't have more than 10920 triangles per batch: " + maxVertices);

        this.layerMask = 1;
        this.maxVerticesLength = maxVertices * MeshBatcher.VERTEX_SIZE * Float32Array.BYTES_PER_ELEMENT;
        this.maxIndicesLength = maxVertices * 3 * Uint16Array.BYTES_PER_ELEMENT;

        this.material = new SkeletonMeshMaterial(`shader_${name}`, scene, materialCustomizer);

        this.actionManager = new ActionManager(scene);
    }

    get is(): string {
        return 'MeshBatcher';
    }

    clear() {
        this.vertexData = {
            positions: [],
            indices: [],
            colors: [],
            uvs: []
        };
        return this;
    }

    begin() {
        this.verticesLength = 0;
        this.indicesLength = 0;
    }

    canBatch(verticesLength: number, indicesLength: number) {
        if (this.indicesLength + indicesLength >= this.maxIndicesLength / 2) return false;
        if (this.verticesLength + verticesLength >= this.maxVerticesLength / 2) return false;
        return true;
    }

    batch(vertices: ArrayLike<number>, verticesLength: number, indices: ArrayLike<number>, indicesLength: number, z: number = 0) {
        // zoffset 0.1 to 1 for alphaIndex and set margin
        this.alphaIndex = Math.abs(z) * 10 + this.depth * 1000;

        let indexStart = this.verticesLength / MeshBatcher.VERTEX_SIZE;
        let j = 0;
        for (; j < verticesLength;) {
            this.vertexData.positions.push(vertices[j++]);
            this.vertexData.positions.push(vertices[j++]);
            this.vertexData.positions.push(z);

            this.vertexData.colors.push(vertices[j++]);
            this.vertexData.colors.push(vertices[j++]);
            this.vertexData.colors.push(vertices[j++]);
            this.vertexData.colors.push(vertices[j++]);

            this.vertexData.uvs.push(vertices[j++]);
            this.vertexData.uvs.push(vertices[j++]);
        }
        this.verticesLength += verticesLength / 8 * 9;

        for (j = 0; j < indicesLength; j++)
            this.vertexData.indices.push(indices[j] + indexStart);

        this.indicesLength += indicesLength;
    }

    end() {
        let vertexData = new VertexData();
        vertexData.indices = this.vertexData.indices;
        vertexData.positions = this.vertexData.positions;
        vertexData.colors = this.vertexData.colors;
        vertexData.uvs = this.vertexData.uvs;

        vertexData.applyToMesh(this, true);
        vertexData = null;
        this.clear();
    }
}
