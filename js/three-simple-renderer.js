// Three.js Minecraft 渲染器
class SimpleThreeRenderer {
    constructor() {
        this.cache = new Map();
    }

    // 管道模型渲染
    async renderPipeModel(modelJson, textureUrls, size = 256) {
        const textureKey = JSON.stringify(textureUrls);
        const cacheKey = `pipe:${textureKey}:${size}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        return new Promise((resolve) => {
            try {
                const scene = new THREE.Scene();
                
                const viewSize = 0.5;
                const camera = new THREE.OrthographicCamera(-viewSize, viewSize, viewSize, -viewSize, 0.1, 100);
                
                const distance = 2.5;
                const rotY = THREE.MathUtils.degToRad(45);
                const rotX = THREE.MathUtils.degToRad(30);
                camera.position.set(
                    distance * Math.sin(rotY) * Math.cos(rotX),
                    distance * Math.sin(rotX),
                    distance * Math.cos(rotY) * Math.cos(rotX)
                );
                camera.lookAt(0, 0, 0);

                const canvas = document.createElement('canvas');
                const renderer = new THREE.WebGLRenderer({ 
                    canvas: canvas,
                    alpha: true,
                    antialias: false,
                    preserveDrawingBuffer: true
                });
                renderer.setSize(size, size);
                renderer.setClearColor(0x000000, 0);

                const textureLoader = new THREE.TextureLoader();
                
                new Promise((texResolve) => {
                    textureLoader.load(
                        textureUrls['1'] || textureUrls['particle'],
                        (tex) => {
                            tex.magFilter = THREE.NearestFilter;
                            tex.minFilter = THREE.NearestFilter;
                            texResolve(tex);
                        },
                        undefined,
                        (err) => {
                            console.error('Pipe texture load failed:', err);
                            texResolve(null);
                        }
                    );
                }).then((tex) => {
                    if (!tex) {
                        resolve(null);
                        return;
                    }

                const group = new THREE.Group();

                group.scale.set(0.8, 0.8, 0.8);

                modelJson.elements.forEach((element, idx) => {
                    const from = element.from.map(v => (v - 8) / 16);
                    const to = element.to.map(v => (v - 8) / 16);
                    
                    const width = to[0] - from[0];
                    const height = to[1] - from[1];
                    const depth = to[2] - from[2];
                    
                    const geometry = new THREE.BoxGeometry(width, height, depth);
                    
                    const materials = [];
                    const faces = element.faces;
                    const faceNames = ['east', 'west', 'up', 'down', 'south', 'north'];
                    
                    faceNames.forEach((faceName, faceIdx) => {
                        const face = faces[faceName];
                        if (face && face.texture) {
                            const texture = tex.clone();
                            texture.needsUpdate = true;
                            
                            if (face.uv) {
                                const [u1, v1, u2, v2] = face.uv;
                                
                                const uMin = Math.min(u1, u2) / 16;
                                const vMin = Math.min(v1, v2) / 16;
                                const uMax = Math.max(u1, u2) / 16;
                                const vMax = Math.max(v1, v2) / 16;
                                
                                texture.offset.set(uMin, 1 - vMax);
                                texture.repeat.set(uMax - uMin, vMax - vMin);
                                
                                if (face.rotation) {
                                    texture.center.set(0.5, 0.5);
                                    texture.rotation = THREE.MathUtils.degToRad(-face.rotation);
                                }
                            }
                            
                            materials.push(new THREE.MeshBasicMaterial({ 
                                map: texture,
                                transparent: true
                            }));
                        } else {
                            materials.push(new THREE.MeshBasicMaterial({ visible: false }));
                        }
                    });
                    
                    const mesh = new THREE.Mesh(geometry, materials);
                    const centerX = (from[0] + to[0]) / 2;
                    const centerY = (from[1] + to[1]) / 2;
                    const centerZ = (from[2] + to[2]) / 2;
                    mesh.position.set(centerX, centerY, centerZ);
                    
                    group.add(mesh);
                });

                scene.add(group);

                const light = new THREE.AmbientLight(0xffffff, 1);
                scene.add(light);

                renderer.render(scene, camera);
                const dataUrl = canvas.toDataURL('image/png');

                group.traverse((child) => {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(m => {
                                if (m.map) m.map.dispose();
                                m.dispose();
                            });
                        }
                    }
                });
                tex.dispose();
                renderer.dispose();

                this.cache.set(cacheKey, dataUrl);
                resolve(dataUrl);
                });
            } catch (error) {
                console.error('Pipe render error:', error);
                resolve(null);
            }
        });
    }

    // Pylon 模型渲染
    async renderPylonModel(modelJson, textureUrls, size = 256) {
        const textureKey = JSON.stringify(textureUrls);
        const cacheKey = `${JSON.stringify(modelJson).substring(0, 50)}:${textureKey}:${size}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        return new Promise((resolve) => {
            try {
            const scene = new THREE.Scene();
            
            const isPortableTank = Object.keys(textureUrls).length > 2;
            const viewSize = isPortableTank ? 0.84 : 0.67;
            const camera = new THREE.OrthographicCamera(-viewSize, viewSize, viewSize, -viewSize, 0.1, 100);
            camera.position.set(1.5, 1.2, 1.5);
            camera.lookAt(0, 0, 0);

            const canvas = document.createElement('canvas');
            const renderer = new THREE.WebGLRenderer({ 
                canvas: canvas,
                alpha: true,
                antialias: false,
                preserveDrawingBuffer: true
            });
            renderer.setSize(size, size);
            renderer.setClearColor(0x000000, 0);

            const group = new THREE.Group();
            
            if (modelJson.elements) {
                const textureLoader = new THREE.TextureLoader();
                const textures = {};
                
                const loadTextures = Object.entries(textureUrls).map(([key, url]) => {
                    return new Promise((res) => {
                        textureLoader.load(url, 
                            (tex) => {
                                tex.magFilter = THREE.NearestFilter;
                                tex.minFilter = THREE.NearestFilter;
                                textures[key] = tex;
                                res();
                            },
                            undefined,
                            (err) => {
                                console.warn(`Failed to load ${key}:`, err);
                                res();
                            }
                        );
                    });
                });

                Promise.all(loadTextures).then(() => {
                    modelJson.elements.forEach((element, idx) => {
                        const from = element.from.map(v => (v - 8) / 16);
                        const to = element.to.map(v => (v - 8) / 16);
                        
                        const width = to[0] - from[0];
                        const height = to[1] - from[1];
                        const depth = to[2] - from[2];
                        
                        const geometry = new THREE.BoxGeometry(width, height, depth);
                        
                        const materials = [];
                        const faces = element.faces || {};
                        const faceNames = ['east', 'west', 'up', 'down', 'south', 'north'];
                        
                        faceNames.forEach(faceName => {
                            const face = faces[faceName];
                            if (face && face.texture) {
                                const texKey = face.texture.replace('#', '');
                                const texture = textures[texKey];
                                
                                if (texture) {
                                    materials.push(new THREE.MeshBasicMaterial({ 
                                        map: texture.clone(),
                                        transparent: true,
                                        alphaTest: 0.1
                                    }));
                                } else {
                                    materials.push(new THREE.MeshBasicMaterial({ 
                                        color: 0xcccccc 
                                    }));
                                }
                            } else {
                                materials.push(new THREE.MeshBasicMaterial({ 
                                    color: 0xcccccc,
                                    transparent: true,
                                    opacity: 0
                                }));
                            }
                        });
                        
                        const mesh = new THREE.Mesh(geometry, materials);
                        
                        const centerX = (from[0] + to[0]) / 2;
                        const centerY = (from[1] + to[1]) / 2;
                        const centerZ = (from[2] + to[2]) / 2;
                        mesh.position.set(centerX, centerY, centerZ);
                        
                        group.add(mesh);
                    });

                    scene.add(group);

                    const light = new THREE.AmbientLight(0xffffff, 1);
                    scene.add(light);

                    renderer.render(scene, camera);

                    const dataUrl = canvas.toDataURL('image/png');
                    
                    group.traverse((child) => {
                        if (child.geometry) child.geometry.dispose();
                        if (child.material) {
                            if (Array.isArray(child.material)) {
                                child.material.forEach(m => {
                                    if (m.map) m.map.dispose();
                                    m.dispose();
                                });
                            } else {
                                if (child.material.map) child.material.map.dispose();
                                child.material.dispose();
                            }
                        }
                    });
                    renderer.dispose();

                    this.cache.set(cacheKey, dataUrl);
                    resolve(dataUrl);
                });
            } else {
                resolve(null);
            }
            } catch (error) {
                resolve(null);
            }
        });
    }
}

window.simpleThreeRenderer = new SimpleThreeRenderer();