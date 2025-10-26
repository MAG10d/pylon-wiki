// Minecraft 模型解析器
class MinecraftModelResolver {
    constructor() {
        this.modelCache = new Map();
        this.baseUrl = 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.21.10/assets/minecraft';
        this.pylonBaseUrl = 'https://cdn.jsdelivr.net/gh/pylonmc/pylon-resource-pack@pack-generator/input/assets/pylonbase';
        
        // 已知無 blockstate 的路徑（減少 404 請求）
        this.noBlockstateCache = new Set([
            'machines/pipes/wood_pipe',
            'machines/pipes/tin_pipe',
            'machines/pipes/iron_pipe',
            'machines/pipes/bronze_pipe',
            'machines/pipes/steel_pipe',
            'machines/pipes/copper_pipe'
        ]);
    }

    parseModelPath(path) {
        if (path.includes(':')) {
            return path;
        }
        if (path.startsWith('block/') || path.startsWith('item/')) {
            return path;
        }
        return `block/${path}`;
    }

    // 獲取 item 定義 JSON (1.21+)
    async fetchItemDefinition(itemPath) {
        const cacheKey = `item:${itemPath}`;
        if (this.modelCache.has(cacheKey)) {
            return this.modelCache.get(cacheKey);
        }

        try {
            const cleanPath = itemPath.replace(/^item\//, '');
            const url = `${this.baseUrl}/items/${cleanPath}.json`;
            const response = await fetch(url, {
                method: 'GET',
                cache: 'default'
            }).catch(() => null);
            
            if (!response || !response.ok) return null;
            
            const itemDef = await response.json();
            this.modelCache.set(cacheKey, itemDef);
            return itemDef;
        } catch (error) {
            return null;
        }
    }

    // 獲取模型 JSON（支援 Pylon 和 Minecraft）
    async fetchModel(modelPath) {
        if (this.modelCache.has(modelPath)) {
            return this.modelCache.get(modelPath);
        }

        try {
            const isPylon = modelPath.startsWith('pylonbase:') || modelPath.includes('pylonbase:');
            let cleanPath, baseUrl;
            
            if (isPylon) {
                cleanPath = modelPath.replace(/^.*pylonbase:/, '');
                baseUrl = this.pylonBaseUrl;
            } else {
                cleanPath = modelPath.replace('minecraft:', '');
                baseUrl = this.baseUrl;
            }
            
            const url = `${baseUrl}/models/${cleanPath}.json`;
            const response = await fetch(url, {
                method: 'GET',
                cache: 'default'
            }).catch(() => null);
            
            if (!response || !response.ok) return null;
            
            const model = await response.json();
            this.modelCache.set(modelPath, model);
            return model;
        } catch (error) {
            return null;
        }
    }

    // 獲取 Pylon 方塊狀態
    async fetchPylonBlockState(blockPath) {
        const cacheKey = `pylon:blockstate:${blockPath}`;
        if (this.modelCache.has(cacheKey)) {
            return this.modelCache.get(cacheKey);
        }

        try {
            const url = `${this.pylonBaseUrl}/blocks/${blockPath}.json`;
            const response = await fetch(url, { 
                method: 'GET',
                cache: 'default'
            }).catch(() => null);
            
            if (!response || !response.ok) return null;
            
            const blockstate = await response.json();
            this.modelCache.set(cacheKey, blockstate);
            return blockstate;
        } catch (error) {
            return null;
        }
    }

    // 遞迴解析模型繼承鏈（支援 Pylon）
    async resolveModel(modelPath, depth = 0) {
        if (depth > 10) {
            console.warn('Model inheritance too deep:', modelPath);
            return null;
        }

        const model = await this.fetchModel(modelPath);
        if (!model) return null;

        let mergedModel = { ...model };
        let mergedTextures = { ...model.textures } || {};
        let elements = model.elements;

        if (model.parent) {
            const parentPath = this.parseModelPath(model.parent);
            const parentModel = await this.resolveModel(parentPath, depth + 1);
            
            if (parentModel) {
                if (!elements && parentModel.elements) {
                    elements = parentModel.elements;
                }
                if (parentModel.textures) {
                    mergedTextures = { ...parentModel.textures, ...mergedTextures };
                }
            }
        }

        return {
            ...mergedModel,
            textures: mergedTextures,
            elements: elements
        };
    }

    // 解析貼圖引用（#all, #particle）
    resolveTextureReferences(textures) {
        const resolved = {};
        const maxIterations = 20;
        let iteration = 0;

        Object.keys(textures).forEach(key => {
            resolved[key] = textures[key];
        });

        let hasReferences = true;
        while (hasReferences && iteration < maxIterations) {
            hasReferences = false;
            iteration++;

            Object.keys(resolved).forEach(key => {
                const value = resolved[key];
                if (typeof value === 'string' && value.startsWith('#')) {
                    const refKey = value.substring(1);
                    if (resolved[refKey] && !resolved[refKey].startsWith('#')) {
                        resolved[key] = resolved[refKey];
                    } else {
                        hasReferences = true;
                    }
                }
            });
        }

        return resolved;
    }

    // 從模型提取主要貼圖
    async getTextureFromModel(modelPath) {
        const model = await this.resolveModel(modelPath);
        if (!model || !model.textures) return null;

        const textures = this.resolveTextureReferences(model.textures);

        // 優先級：layer0 > particle > all
        const priorities = ['layer0', 'particle', 'all', 'texture', 'north', 'up'];
        
        for (const key of priorities) {
            if (textures[key] && !textures[key].startsWith('#')) {
                return textures[key].replace('minecraft:', '');
            }
        }

        for (const [key, value] of Object.entries(textures)) {
            if (value && !value.startsWith('#')) {
                return value.replace('minecraft:', '');
            }
        }

        return null;
    }

    // 從方塊狀態獲取貼圖
    async getTextureFromBlockState(blockstatePath) {
        try {
            const url = `${this.baseUrl}/blockstates/${blockstatePath}.json`;
            const response = await fetch(url, {
                method: 'GET',
                cache: 'default'
            }).catch(() => null);
            
            if (!response || !response.ok) return null;

            const blockstate = await response.json();
            
            let modelPath = null;
            if (blockstate.variants) {
                const firstVariant = Object.values(blockstate.variants)[0];
                if (Array.isArray(firstVariant)) {
                    modelPath = firstVariant[0].model;
                } else {
                    modelPath = firstVariant.model;
                }
            }

            if (modelPath) {
                return await this.getTextureFromModel(this.parseModelPath(modelPath));
            }
        } catch (error) {
            console.warn(`Failed to load blockstate: ${blockstatePath}`, error);
        }
        return null;
    }

    // 從 item 定義提取貼圖 (1.21+)
    async getTextureFromItemDefinition(itemPath) {
        const itemDef = await this.fetchItemDefinition(itemPath);
        if (!itemDef || !itemDef.model) return null;

        const model = itemDef.model;

        if (model.type === 'minecraft:special' && model.model) {
            const specialModel = model.model;
            
            if (specialModel.type === 'minecraft:head' && specialModel.kind) {
                const kind = specialModel.kind;
                if (specialModel.texture) {
                    return `entity/${specialModel.texture}.png`;
                }
                const entityMap = {
                    'skeleton': 'entity/skeleton/skeleton.png',
                    'wither_skeleton': 'entity/skeleton/wither_skeleton.png',
                    'zombie': 'entity/zombie/zombie.png',
                    'creeper': 'entity/creeper/creeper.png',
                    'piglin': 'entity/piglin/piglin.png',
                    'dragon': 'entity/enderdragon/dragon.png',
                    'player': 'entity/steve.png'
                };
                const texture = entityMap[kind];
                if (texture) {
                return texture;
                }
            }
        }

        if (typeof model === 'string') {
            const modelPath = this.parseModelPath(model);
            return await this.getTextureFromModel(modelPath);
        }
        
        if (model.type === 'minecraft:model' && model.model) {
            const modelPath = this.parseModelPath(model.model);
            return await this.getTextureFromModel(modelPath);
        }

        return null;
    }

    // 從 Pylon item 定義獲取模型
    async getPylonItemModel(itemPath) {
        try {
            const url = `${this.pylonBaseUrl}/items/${itemPath}.json`;
            const response = await fetch(url, {
                method: 'GET',
                cache: 'default'
            }).catch(() => null);
            
            if (!response || !response.ok) return null;
            
            const itemDef = await response.json();
            
            let modelPath = null;
            if (itemDef.model) {
                if (itemDef.model.type === 'condition') {
                    if (itemDef.model.on_false && itemDef.model.on_false.model) {
                        modelPath = itemDef.model.on_false.model;
                    } else if (itemDef.model.fallback && itemDef.model.fallback.model) {
                        modelPath = itemDef.model.fallback.model;
                    }
                } else if (itemDef.model.type === 'model' && itemDef.model.model) {
                    modelPath = itemDef.model.model;
                } else if (typeof itemDef.model === 'string') {
                    modelPath = itemDef.model;
                }
            }
            
            if (modelPath) {
                return await this.resolveModel(modelPath);
            }
        } catch (error) {
            return null;
        }
        
        return null;
    }

    // 從 Pylon 方塊狀態獲取模型數據
    async getPylonBlockModel(blockPath) {
        const skipBlockstate = this.noBlockstateCache.has(blockPath);
        
        if (!skipBlockstate) {
            const blockstate = await this.fetchPylonBlockState(blockPath);
            if (blockstate && blockstate.variants) {
                const firstVariant = Object.values(blockstate.variants)[0];
                const modelPath = Array.isArray(firstVariant) ? firstVariant[0].model : firstVariant.model;
                
                if (modelPath) {
                    const model = await this.resolveModel(modelPath);
                    if (model && model.elements) {
                        return model;
                    }
                }
            } else {
                this.noBlockstateCache.add(blockPath);
            }
        }
        
        const modelPath = `pylonbase:block/${blockPath}`;
        const model = await this.resolveModel(modelPath);
        
        if (model && model.elements) {
            return model;
        }
        
        return null;
    }

    // 主入口：解析任意路徑
    async resolve(path) {
        if (path.includes('.png')) {
            return path;
        }

        const isPylon = path.startsWith('pylon:');
        if (isPylon) {
            const cleanPath = path.replace('pylon:', '');
            
            // 根據路徑判斷是 item 還是 block
            // machines/pipes/* 是 block
            // tools/*, combat/*, science/* 等通常是 item
            const isLikelyBlock = cleanPath.startsWith('machines/');
            
            let model = null;
            
            if (isLikelyBlock) {
                // 優先嘗試 block
                model = await this.getPylonBlockModel(cleanPath);
                if (!model) {
                    model = await this.getPylonItemModel(cleanPath);
                }
            } else {
                // 優先嘗試 item
                model = await this.getPylonItemModel(cleanPath);
                if (!model) {
                    model = await this.getPylonBlockModel(cleanPath);
                }
            }
            
            if (model) {
                return { type: 'pylon-model', model: model, path: cleanPath };
            }
        }

        const isItem = path.startsWith('item/');
        const isBlock = path.startsWith('block/');
        
        if (isItem) {
            const itemTexture = await this.getTextureFromItemDefinition(path);
            if (itemTexture) {
                return itemTexture;
            }
            
            const modelTexture = await this.getTextureFromModel(path);
            if (modelTexture) return modelTexture;
            
            console.warn(`Failed to resolve item: ${path}`);
            return path;
        }
        
        if (isBlock) {
            const blockTexture = await this.getTextureFromBlockState(path);
            if (blockTexture) return blockTexture;
            
            const modelTexture = await this.getTextureFromModel(path);
            if (modelTexture) return modelTexture;
        }

        const modelTexture = await this.getTextureFromModel(path);
        if (modelTexture) return modelTexture;

        console.warn(`Failed to resolve: ${path}`);
        return path;
    }
}

const modelResolver = new MinecraftModelResolver();