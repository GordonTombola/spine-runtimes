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

import { AnimationState, AnimationStateData, BlendMode, ClippingAttachment, Color, MeshAttachment, NumberArrayLike, RegionAttachment, Skeleton, SkeletonClipping, SkeletonData, TextureAtlasRegion, Utils, Vector2, VertexEffect } from "@esotericsoftware/spine-core";
import { MeshBatcher } from "./MeshBatcher";
import { BabylonJsTexture } from "./BabylonJsTexture";
import { AbstractMesh, ActionManager, Constants, ExecuteCodeAction, IShaderMaterialOptions, Mesh, Observable, Scene, ShaderMaterial } from "@babylonjs/core";


export type SkeletonMeshMaterialOptionsCustomizer = (materialParameters: Partial<IShaderMaterialOptions>) => void;

export class SkeletonMeshMaterial extends ShaderMaterial {
    constructor(name: string, scene: Scene, customizer: SkeletonMeshMaterialOptionsCustomizer) {
        let vertexShader = `
            precision highp float;

            // Attributes
            attribute vec3 position;
            attribute vec3 normal;
            attribute vec2 uv;

            // Uniforms
            uniform mat4 worldViewProjection;

            // Varying
            varying vec4 vPosition;
            varying vec3 vNormal;
            varying vec2 vUV;

			void main() {
                vec4 p = vec4( position, 1.0 );

                vPosition = p;
                vNormal = normal;
    
                vUV = uv;
                // vUV.y =1.0-vUV.y;     // flip uv screen ;
                gl_Position = worldViewProjection * p;
			}
		`;
        let fragmentShader = `
			uniform sampler2D map;
			#ifdef USE_SPINE_ALPHATEST
			uniform float alphaTest;
			#endif
			varying vec2 vUv;
			varying vec4 vColor;
			void main(void) {
				gl_FragColor = texture2D(map, vUv)*vColor;
				#ifdef USE_SPINE_ALPHATEST
				if (gl_FragColor.a < alphaTest) discard;
				#endif
			}
		`;

        const options: Partial<IShaderMaterialOptions> = {
            attributes: ["position", "normal", "uv"],
            uniforms: ["map", "world", "worldView", "worldViewProjection",
                "view", "projection", "time", "direction", "iResolution"],
            needAlphaBlending: true,
            needAlphaTesting: false
        }
        const routes = {
            vertexSource: vertexShader,
            fragmentSource: fragmentShader
        }

        customizer(options);
        super(name, scene, routes, options);
        if (options.needAlphaTesting) {
            options.defines = ["USE_SPINE_ALPHATEST"];
        }
        this.backFaceCulling = false;
        this.alpha = 1.0;
    };
}

export class SkeletonMesh extends AbstractMesh {
    private spineSkeleton: Skeleton;
    private spineState: AnimationState;

    tempPos: Vector2 = new Vector2();
    tempUv: Vector2 = new Vector2();
    tempLight = new Color();
    tempDark = new Color();

    zOffset: number = -0.1;
    vertexEffect: VertexEffect;

    private batches = new Array<MeshBatcher>();
    private nextBatchIndex = 0;
    private clipper: SkeletonClipping = new SkeletonClipping();

    static QUAD_TRIANGLES = [0, 1, 2, 2, 3, 0];
    static VERTEX_SIZE = 2 + 2 + 4;

    private vertices = Utils.newFloatArray(1024) as number[];
    private tempColor = new Color();


    public readonly onPickDownObservable = new Observable<any>();

    constructor(name: string, scene: Scene, skeletonData: SkeletonData, private materialCustomerizer: SkeletonMeshMaterialOptionsCustomizer = (material) => { }) {
        super(name, scene);
        this.spineSkeleton = new Skeleton(skeletonData);
        const animStateData = new AnimationStateData(skeletonData);
        this.spineState = new AnimationState(animStateData);
        this.billboardMode = Mesh.BILLBOARDMODE_ALL;
    }

    public getClassName(): string {
        return 'SkeletonMesh';
    }

    public setDepth(d: number) {
        this.getDescendants().forEach(function (child) {
            (<MeshBatcher>child).depth = d;
        });
    }

    update(deltaTime: number) {
        const state = this.spineState;
        const skeleton = this.spineSkeleton;

        state.update(deltaTime);
        state.apply(skeleton);
        skeleton.updateWorldTransform();

        this.updateGeometry();
    }

    dispose() {
        for (var i = 0; i < this.batches.length; i++) {
            this.batches[i].dispose();
        }
    }

    private clearBatches() {
        for (var i = 0; i < this.batches.length; i++) {
            this.batches[i].clear();
            this.batches[i].isVisible = false;
        }
        this.nextBatchIndex = 0;
    }

    private nextBatch() {
        if (this.batches.length == this.nextBatchIndex) {
            const batch = new MeshBatcher('batcher_' + this.nextBatchIndex, this.getScene(), this.materialCustomerizer);
            batch.parent = this;

            const onPickDown = new ExecuteCodeAction(ActionManager.OnPickDownTrigger,
                (e) => {
                    const pickInfo = this.getScene().pick(e.pointerX, e.pointerY, () => true);
                    this.onPickDownObservable.notifyObservers({ name: this.name, pickedPoint: pickInfo.pickedPoint });
                });
            batch.actionManager.registerAction(onPickDown);
            this.batches.push(batch);
            batch.material.freeze();
        }
        const batch = this.batches[this.nextBatchIndex++];
        batch.isVisible = true;
        return batch;
    }

    private updateGeometry() {
        this.clearBatches();
        const clipper = this.clipper;
        let vertices: number[] = this.vertices;
        let triangles: Array<number> = null;
        let uvs: ArrayLike<number> = null;
        let drawOrder = this.spineSkeleton.drawOrder;
        let batch = this.nextBatch();
        batch.begin();
        let z = 0;
        let zOffset = this.zOffset;
        for (let i = 0, n = drawOrder.length; i < n; i++) {
            let vertexSize = clipper.isClipping() ? 2 : SkeletonMesh.VERTEX_SIZE;
            let slot = drawOrder[i];
            if (!slot.bone.active) {
                clipper.clipEndWithSlot(slot);
                continue;
            }
            let attachment = slot.getAttachment();
            let attachmentColor: Color = null;
            let texture: BabylonJsTexture = null;
            let numFloats = 0;
            if (attachment instanceof RegionAttachment) {
                let region = <RegionAttachment>attachment;
                attachmentColor = region.color;
                vertices = this.vertices;
                numFloats = vertexSize * 4;
                region.computeWorldVertices(slot.bone, vertices, 0, vertexSize);
                triangles = SkeletonMesh.QUAD_TRIANGLES;
                uvs = region.uvs;
                texture = <BabylonJsTexture>(<TextureAtlasRegion>region.region.renderObject).page.texture;
            } else if (attachment instanceof MeshAttachment) {
                let mesh = <MeshAttachment>attachment;
                attachmentColor = mesh.color;
                vertices = this.vertices;
                numFloats = (mesh.worldVerticesLength >> 1) * vertexSize;
                if (numFloats > vertices.length) {
                    vertices = this.vertices = Utils.newFloatArray(numFloats) as number[];
                }
                mesh.computeWorldVertices(slot, 0, mesh.worldVerticesLength, vertices, 0, vertexSize);
                triangles = mesh.triangles;
                uvs = mesh.uvs;
                texture = <BabylonJsTexture>(<TextureAtlasRegion>mesh.region.renderObject).page.texture;
            } else if (attachment instanceof ClippingAttachment) {
                let clip = <ClippingAttachment>(attachment);
                clipper.clipStart(slot, clip);
                continue;
            } else {
                clipper.clipEndWithSlot(slot);
                continue;
            }

            if (texture != null) {
                let skeleton = slot.bone.skeleton;
                let skeletonColor = skeleton.color;
                let slotColor = slot.color;
                let alpha = skeletonColor.a * slotColor.a * attachmentColor.a;
                let color = this.tempColor;
                color.set(skeletonColor.r * slotColor.r * attachmentColor.r,
                    skeletonColor.g * slotColor.g * attachmentColor.g,
                    skeletonColor.b * slotColor.b * attachmentColor.b,
                    alpha);

                let finalVertices: NumberArrayLike;
                let finalVerticesLength: number;
                let finalIndices: NumberArrayLike;
                let finalIndicesLength: number;

                if (clipper.isClipping()) {
                    clipper.clipTriangles(vertices, numFloats, triangles, triangles.length, uvs, color, null, false);
                    let clippedVertices = clipper.clippedVertices;
                    let clippedTriangles = clipper.clippedTriangles;
                    if (this.vertexEffect != null) {
                        let vertexEffect = this.vertexEffect;
                        let verts = clippedVertices;
                        for (let v = 0, n = clippedVertices.length; v < n; v += vertexSize) {
                            this.tempPos.x = verts[v];
                            this.tempPos.y = verts[v + 1];
                            this.tempLight.setFromColor(color);
                            this.tempDark.set(0, 0, 0, 0);
                            this.tempUv.x = verts[v + 6];
                            this.tempUv.y = verts[v + 7];
                            vertexEffect.transform(this.tempPos, this.tempUv, this.tempLight, this.tempDark);
                            verts[v] = this.tempPos.x;
                            verts[v + 1] = this.tempPos.y;
                            verts[v + 2] = this.tempLight.r;
                            verts[v + 3] = this.tempLight.g;
                            verts[v + 4] = this.tempLight.b;
                            verts[v + 5] = this.tempLight.a;
                            verts[v + 6] = this.tempUv.x;
                            verts[v + 7] = this.tempUv.y;
                        }
                    }
                    finalVertices = clippedVertices;
                    finalVerticesLength = clippedVertices.length;
                    finalIndices = clippedTriangles;
                    finalIndicesLength = clippedTriangles.length;
                } else {
                    let verts = vertices;
                    if (this.vertexEffect != null) {
                        let vertexEffect = this.vertexEffect;
                        for (let v = 0, u = 0, n = numFloats; v < n; v += vertexSize, u += 2) {
                            this.tempPos.x = verts[v];
                            this.tempPos.y = verts[v + 1];
                            this.tempLight.setFromColor(color);
                            this.tempDark.set(0, 0, 0, 0);
                            this.tempUv.x = uvs[u];
                            this.tempUv.y = uvs[u + 1];
                            vertexEffect.transform(this.tempPos, this.tempUv, this.tempLight, this.tempDark);
                            verts[v] = this.tempPos.x;
                            verts[v + 1] = this.tempPos.y;
                            verts[v + 2] = this.tempLight.r;
                            verts[v + 3] = this.tempLight.g;
                            verts[v + 4] = this.tempLight.b;
                            verts[v + 5] = this.tempLight.a;
                            verts[v + 6] = this.tempUv.x;
                            verts[v + 7] = this.tempUv.y;
                        }
                    } else {
                        for (let v = 2, u = 0, n = numFloats; v < n; v += vertexSize, u += 2) {
                            verts[v] = color.r;
                            verts[v + 1] = color.g;
                            verts[v + 2] = color.b;
                            verts[v + 3] = color.a;
                            verts[v + 4] = uvs[u];
                            verts[v + 5] = uvs[u + 1];
                        }
                    }
                    finalVertices = vertices;
                    finalVerticesLength = numFloats;
                    finalIndices = triangles;
                    finalIndicesLength = triangles.length;
                }

                if (finalVerticesLength == 0 || finalIndicesLength == 0) {
                    clipper.clipEndWithSlot(slot);
                    continue;
                }

                // Start new batch if this one can't hold vertices/indices
                if (!batch.canBatch(finalVerticesLength, finalIndicesLength)) {
                    batch.end();
                    batch = this.nextBatch();
                    batch.begin();
                }

                let batchMaterial = <SkeletonMeshMaterial>batch.material;
                if (batchMaterial.getActiveTextures().length == 0) {
                    batchMaterial.setTexture('map', texture.texture);
                }
                if (!batchMaterial.hasTexture(texture.texture)) {
                    batch.end();
                    batch = this.nextBatch();
                    batch.begin();
                    batchMaterial = <SkeletonMeshMaterial>batch.material;
                    batchMaterial.setTexture('map', texture.texture);
                }


                //WHAT THEY DO IN THREEJS - need to be sure I make use of the blendmode info if it is vital

                // const slotBlendMode = slot.data.blendMode;
                // const slotTexture = texture.texture;
                // const materialGroup = batch.findMaterialGroup(slotTexture, slotBlendMode);

                // batch.addMaterialGroup(finalIndicesLength, materialGroup);


                batch.batch(finalVertices, finalVerticesLength, finalIndices, finalIndicesLength, z);
                z += zOffset;
            }

            clipper.clipEndWithSlot(slot);
        }
        clipper.clipEnd();
        batch.end();

    }
}
