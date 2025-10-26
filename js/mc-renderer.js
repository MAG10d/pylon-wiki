// Minecraft 物品 3D 渲染器
// 使用 Canvas 2D 繪製等軸視圖

class MinecraftItemRenderer {
    constructor() {
        this.cache = new Map();
    }

    // 創建立方體等軸視圖
    renderCube(texture, size = 64) {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                ctx.imageSmoothingEnabled = false;
                
                const cubeSize = size * 0.6 * 1.5;
                const centerX = size / 2;
                const centerY = size / 2 + size * 0.1;
                
                ctx.save();
                ctx.translate(centerX - cubeSize * 0.5, centerY - cubeSize * 0.15);
                ctx.transform(1, 0.5, 0, 1, 0, 0);
                ctx.globalAlpha = 0.8;
                ctx.drawImage(img, 0, 0, cubeSize, cubeSize);
                ctx.restore();
                
                ctx.save();
                ctx.translate(centerX + cubeSize * 0.5, centerY - cubeSize * 0.15);
                ctx.transform(-1, -0.5, 0, 1, 0, 0);
                ctx.globalAlpha = 0.65;
                ctx.drawImage(img, 0, 0, cubeSize, cubeSize);
                ctx.restore();
                
                ctx.save();
                ctx.translate(centerX, centerY - cubeSize * 0.65);
                ctx.beginPath();
                ctx.moveTo(0, -cubeSize * 0.25);
                ctx.lineTo(cubeSize * 0.5, 0);
                ctx.lineTo(0, cubeSize * 0.25);
                ctx.lineTo(-cubeSize * 0.5, 0);
                ctx.closePath();
                ctx.clip();
                
                ctx.globalAlpha = 1;
                ctx.translate(-cubeSize/2, -cubeSize/2);
                ctx.drawImage(img, 0, 0, cubeSize, cubeSize);
                ctx.restore();
                
                resolve(canvas.toDataURL());
            };
            img.onerror = reject;
            img.src = texture;
        });
    }

    // 渲染頭顱（使用 entity 貼圖）
    async renderHead(entityTexture, size = 64) {
        const cacheKey = `head:${entityTexture}:${size}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');

            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            const dataUrl = await new Promise((resolve, reject) => {
                img.onload = () => {
                    ctx.imageSmoothingEnabled = false;
                    const scale = size / 24 * 1.5;
                    
                    ctx.save();
                    ctx.translate(size/2, size/4);
                    ctx.transform(1, -0.5, 1, 0.5, 0, 0);
                    ctx.drawImage(img, 8, 0, 8, 8, -6*scale, -6*scale, 12*scale, 12*scale);
                    ctx.restore();
                    
                    ctx.save();
                    ctx.translate(size/2 - 12*scale, size/2 - 12);
                    ctx.transform(1, 0.5, 0, 1, 0, 0);
                    ctx.drawImage(img, 8, 8, 8, 8, 0, 0, 12*scale, 12*scale);
                    ctx.restore();
                    
                    ctx.save();
                    ctx.translate(size/2, size/2);
                    ctx.transform(1, -0.5, 0, 1, 0, 0);
                    ctx.globalAlpha = 0.8;
                    ctx.drawImage(img, 16, 8, 8, 8, 0, 0, 12*scale, 12*scale);
                    ctx.restore();
                    
                    resolve(canvas.toDataURL());
                };
                img.onerror = reject;
                img.src = entityTexture;
            });

            this.cache.set(cacheKey, dataUrl);
            return dataUrl;
        } catch (error) {
            console.error('Failed to render head:', error);
            return null;
        }
    }

    // 渲染 Pylon 模型（基於 elements 解析）
    async renderPylonModel(modelData, size = 64) {
        try {
            const model = modelData.model;
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = false;

            const textures = model.textures || {};
            const textureImages = {};
            
            for (const [key, value] of Object.entries(textures)) {
                if (value.startsWith('pylonbase:')) {
                    const texPath = value.replace('pylonbase:', '');
                    const url = `https://cdn.jsdelivr.net/gh/pylonmc/pylon-resource-pack@pack-generator/input/assets/pylonbase/textures/${texPath}.png`;
                    
                    try {
                        const img = await this.loadImage(url);
                        textureImages[key] = img;
                    } catch (e) {
                        console.warn(`Failed to load texture ${key}:`, url);
                    }
                }
            }

            if (!model.elements || model.elements.length === 0) return null;

            let minX = 16, minY = 16, minZ = 16;
            let maxX = 0, maxY = 0, maxZ = 0;
            
            model.elements.forEach(el => {
                minX = Math.min(minX, el.from[0]);
                minY = Math.min(minY, el.from[1]);
                minZ = Math.min(minZ, el.from[2]);
                maxX = Math.max(maxX, el.to[0]);
                maxY = Math.max(maxY, el.to[1]);
                maxZ = Math.max(maxZ, el.to[2]);
            });

            const width = maxX - minX;
            const height = maxY - minY;
            const depth = maxZ - minZ;
            
            const scale = size / (width + depth);
            const isoWidth = width * scale;
            const isoDepth = depth * scale;
            const isoHeight = height * scale;
            
            const centerX = size / 2;
            const centerY = size / 2;

            // 貼圖引用解析（#0, #1, #2）
            const resolveTexture = (texRef) => {
                if (texRef && texRef.startsWith('#')) {
                    const key = texRef.substring(1);
                    return textureImages[key];
                }
                return null;
            };

            ctx.save();
            ctx.translate(centerX - isoWidth * 0.5, centerY);
            ctx.transform(1, 0.5, 0, 1, 0, 0);
            ctx.globalAlpha = 0.7;
            const leftTex = resolveTexture('#0') || textureImages['particle'];
            if (leftTex) {
                ctx.drawImage(leftTex, 0, -isoHeight, isoDepth, isoHeight);
            }
            ctx.restore();

            ctx.save();
            ctx.translate(centerX + isoWidth * 0.5, centerY);
            ctx.transform(-1, -0.5, 0, 1, 0, 0);
            ctx.globalAlpha = 0.6;
            const rightTex = resolveTexture('#0') || textureImages['particle'];
            if (rightTex) {
                ctx.drawImage(rightTex, 0, -isoHeight, isoWidth, isoHeight);
            }
            ctx.restore();

            ctx.save();
            ctx.translate(centerX, centerY - isoHeight);
            ctx.transform(1, -0.5, 1, 0.5, 0, 0);
            ctx.globalAlpha = 1;
            const topTex = resolveTexture('#1') || resolveTexture('#0') || textureImages['particle'];
            if (topTex) {
                ctx.drawImage(topTex, -isoWidth/2, -isoDepth/2, isoWidth, isoDepth);
            }
            ctx.restore();

            return canvas.toDataURL();
        } catch (error) {
            console.error('Failed to render Pylon model:', error);
            return null;
        }
    }

    loadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = url;
        });
    }

    async renderPipe(texture, size = 64) {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                ctx.imageSmoothingEnabled = false;
                const imgSize = Math.min(size * 0.7, img.width, img.height);
                const x = (size - imgSize) / 2;
                const y = (size - imgSize) / 2;
                
                ctx.drawImage(img, x, y, imgSize, imgSize);
                
                resolve(canvas.toDataURL());
            };
            img.onerror = reject;
            img.src = texture;
        });
    }

    async renderWithThreeJS(modelData, textureUrls, size = 256) {
        if (typeof window.simpleThreeRenderer === 'undefined') {
            console.warn('Three.js renderer not loaded');
            return null;
        }

        try {
            let model = modelData;
            if (modelData.data) {
                model = modelData.data;
            }
            if (model.model) {
                model = model.model;
            }
            
            return await window.simpleThreeRenderer.renderPylonModel(model, textureUrls, size);
        } catch (error) {
            console.error('Three.js render failed:', error);
            return null;
        }
    }

    async render(type, data, size = 48) {
        switch (type) {
            case 'head':
                return await this.renderHead(data, size);
            case 'cube':
                return await this.renderCube(data, size);
            case 'pipe':
                return await this.renderPipe(data, size);
            case 'pylon-3d':
                const modelData = typeof data === 'string' ? JSON.parse(data) : data;
                const model = modelData.data ? modelData.data.model : modelData.model;
                
                const textureUrls = {};
                if (model && model.textures) {
                    Object.entries(model.textures).forEach(([key, value]) => {
                        if (value.startsWith('pylonbase:')) {
                            const path = value.replace('pylonbase:', '');
                            textureUrls[key] = `https://cdn.jsdelivr.net/gh/pylonmc/pylon-resource-pack@pack-generator/input/assets/pylonbase/textures/${path}.png`;
                        }
                    });
                }
                
                const isPipe = Object.keys(model.textures || {}).length <= 2;
                
                if (isPipe && window.simpleThreeRenderer) {
                    const result = await window.simpleThreeRenderer.renderPipeModel(model, textureUrls, size * 5);
                    if (result) return result;
                } else {
                    const renderSize = size * 4;
                    const result = await this.renderWithThreeJS(modelData, textureUrls, renderSize);
                    if (result) return result;
                }
                
                return await this.renderPylonModel(modelData, size);
            default:
                return data;
        }
    }
}

const mcRenderer = new MinecraftItemRenderer();