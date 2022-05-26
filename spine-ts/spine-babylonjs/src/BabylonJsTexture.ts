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

import { Constants, Scene, Texture as BabylonTexture } from "@babylonjs/core";
import { BlendMode, Texture, TextureFilter, TextureWrap } from "@esotericsoftware/spine-core";

export class BabylonJsTexture extends Texture {

    public readonly texture: BabylonTexture;

    constructor(image: HTMLImageElement, scene: Scene) {
        super(image);
        this.texture = new BabylonTexture(image.src, scene, false, false);
        this.texture.hasAlpha = true;
    }

    setFilters(minFilter: TextureFilter, magFilter: TextureFilter) {
        this.texture.updateSamplingMode(BabylonJsTexture.toBabylonJsTextureFilter(minFilter, magFilter));
    }

    setWraps(uWrap: TextureWrap, vWrap: TextureWrap) {
        this.texture.wrapU = BabylonJsTexture.toBabylonJsTextureWrap(uWrap);
        this.texture.wrapV = BabylonJsTexture.toBabylonJsTextureWrap(vWrap);
    }

    dispose() {
        this.texture.dispose();
    }

    static toBabylonJsTextureFilter(minFilter: TextureFilter, magFilter: TextureFilter) {
        if (magFilter !== TextureFilter.Linear && magFilter !== TextureFilter.Nearest) {
            //something dodgy, mag filter can only be either of these two values
            throw new Error("Unknown texture mag filter: " + magFilter);
        }
        switch (magFilter) {
            case TextureFilter.Linear:
                if (minFilter === TextureFilter.Linear) { return Constants.TEXTURE_LINEAR_LINEAR }
                if (minFilter === TextureFilter.Nearest) { return Constants.TEXTURE_LINEAR_NEAREST }
                //last bit is the mipmap setting
                //first bit is the min filter setting
                if (minFilter === TextureFilter.MipMapLinearLinear) { return Constants.TEXTURE_LINEAR_LINEAR_MIPLINEAR }
                if (minFilter === TextureFilter.MipMapLinearNearest) { return Constants.TEXTURE_LINEAR_LINEAR_MIPNEAREST }
                if (minFilter === TextureFilter.MipMapNearestLinear) { return Constants.TEXTURE_LINEAR_NEAREST_MIPLINEAR }
                if (minFilter === TextureFilter.MipMapNearestNearest) { return Constants.TEXTURE_LINEAR_NEAREST_MIPNEAREST }
                throw new Error("Unknown texture min filter: " + minFilter);
            case TextureFilter.Nearest:
                if (minFilter === TextureFilter.Linear) { return Constants.TEXTURE_NEAREST_LINEAR }
                if (minFilter === TextureFilter.Nearest) { return Constants.TEXTURE_NEAREST_NEAREST }
                if (minFilter === TextureFilter.MipMapLinearLinear) { return Constants.TEXTURE_NEAREST_LINEAR_MIPLINEAR }
                if (minFilter === TextureFilter.MipMapLinearNearest) { return Constants.TEXTURE_NEAREST_LINEAR_MIPNEAREST }
                if (minFilter === TextureFilter.MipMapNearestLinear) { return Constants.TEXTURE_NEAREST_NEAREST_MIPLINEAR }
                if (minFilter === TextureFilter.MipMapNearestNearest) { return Constants.TEXTURE_NEAREST_NEAREST_MIPNEAREST }
                throw new Error("Unknown texture min filter: " + minFilter);
            default:
                throw new Error("Unknown texture mag filter: " + magFilter);
        }
    }

    static toBabylonJsTextureWrap(wrap: TextureWrap) {
        if (wrap === TextureWrap.ClampToEdge) return Constants.TEXTURE_CLAMP_ADDRESSMODE;
        else if (wrap === TextureWrap.MirroredRepeat) return Constants.TEXTURE_MIRROR_ADDRESSMODE;
        else if (wrap === TextureWrap.Repeat) return Constants.TEXTURE_WRAP_ADDRESSMODE;
        else throw new Error("Unknown texture wrap: " + wrap);
    }

    static toBabylonJsBlending(blend: BlendMode) {
        if (blend === BlendMode.Normal) return Constants.ALPHA_COMBINE;
        else if (blend === BlendMode.Additive) return Constants.ALPHA_ADD;
        else if (blend === BlendMode.Multiply) return Constants.ALPHA_MULTIPLY;
        else if (blend === BlendMode.Screen) return Constants.ALPHA_SCREENMODE;
        else throw new Error("Unknown blendMode: " + blend);
    }
}