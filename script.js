let canvas, ctx, blocks = [], currentBackground, resizeTimeout;
let templates = {};
let generatedImages = [];
let currentImageIndex = 0;
let backgroundImage = null;
let aspectRatio = 1; // 添加这个变量来存储宽高比

const gradientPresets = {
    sunset: { startColor: '#FF512F', endColor: '#F09819', name: '日落' },
    ocean: { startColor: '#2E3192', endColor: '#1BFFFF', name: '海洋' },
    forest: { startColor: '#134E5E', endColor: '#71B280', name: '森林' },
    lavender: { startColor: '#834D9B', endColor: '#D04ED6', name: '薰衣草' },
    fire: { startColor: '#FF0000', endColor: '#FDCF58', name: '火焰' }
};

class Block {
    constructor(height = 100, width) {
        this.height = height;
        this.width = width;
        this.type = 'text';
        this.content = '新文字块';
        this.textAlign = 'center';
        this.verticalAlign = 'middle';
        this.font = 'SimSun';
        this.fontSize = 16;
        this.x = 0;
        this.y = 0;
        this.isEditing = false; // 添加新属性
        this.contentX = 0;
        this.contentY = 0; // 添加新属性，用于内部元素的Y坐标
        this.isCollapsed = false; // 新增属性
        this.name = ''; // 新增name属性
        this.lineHeight = 1.2; // 添加行高属性
        this.imageWidth = 0;
        this.imageHeight = 0;
        this.isBold = false; // 添加粗体属性
        this.isItalic = false; // 添加斜体属性
        this.opacity = 1; // 添加透明度属性,默认为1(完全不透明)
        this.textColor = '#000000'; // 添加文字颜色属性，默认为黑色
    }
    
    loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                // 计算缩放比例
                const scaleX = this.width / img.width;
                const scaleY = this.height / img.height;
                const scale = Math.min(scaleX, scaleY, 1); // 不超过1，避免放大

                // 计算缩放后的尺寸
                this.imageWidth = Math.round(img.width * scale);
                this.imageHeight = Math.round(img.height * scale);

                this.image = img;
                resolve();
            };
            img.onerror = reject;
            img.src = src;
        });
    }
    render(ctx) {
        // 保存当前上下文状态
        ctx.save();
        // 设置全局透明度
        ctx.globalAlpha = this.opacity;
        
        // 使用this.x和this.y绘制Block的边框和背景
        ctx.fillStyle = 'rgba(200, 200, 200, 0)';
        ctx.fillRect(this.x, this.y, this.width, this.height);

        if (this.type === 'text') {
            ctx.fillStyle = this.textColor; // 使用 this.textColor
            let fontString = `${this.fontSize}px "${this.font}", sans-serif`;
            if (this.isBold) fontString = 'bold ' + fontString;
            if (this.isItalic) fontString = 'italic ' + fontString;
            ctx.font = fontString;
            ctx.textAlign = this.textAlign;
            ctx.textBaseline = 'top';
    
            let textX = this.x + this.contentX;
            if (this.textAlign === 'center') textX += this.width / 2;
            else if (this.textAlign === 'right') textX += this.width;
    
            // 计算文本的总高度
            const lines = this.content.split('\n');
            const lineHeight = this.fontSize * this.lineHeight;
            const totalTextHeight = lines.length * lineHeight;
    
            // 根据 verticalAlign 调整起始 Y 坐标
            let textY = this.y + this.contentY;
            if (this.verticalAlign === 'middle') {
                textY += (this.height - totalTextHeight) / 2;
            } else if (this.verticalAlign === 'bottom') {
                textY += this.height - totalTextHeight;
            }
    
            // 绘制每一行文本
            lines.forEach((line, index) => {
                ctx.fillText(line, textX, textY + index * lineHeight);
            });
        } else if (this.type === 'image' && this.image) {
            const x = this.x + this.contentX + (this.width - this.imageWidth) / 2;
            const y = this.y + this.contentY + (this.height - this.imageHeight) / 2;
            ctx.drawImage(this.image, x, y, this.imageWidth, this.imageHeight);
        }
        
        // 如果Block正在编辑,添加边框
        if (this.isEditing) {
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 2;
            ctx.strokeRect(this.x, this.y, this.width, this.height);
        }
        // 恢复上下文状态
        ctx.restore();
    }
}

function setBackground(type, options) {
    if (!ctx) return;

    switch(type) {
        case 'solid':
            ctx.fillStyle = options.color;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            break;
        case 'gradient':
            const angle = options.angle * Math.PI / 180;
            const x1 = canvas.width / 2 + Math.cos(angle) * canvas.width;
            const y1 = canvas.height / 2 + Math.sin(angle) * canvas.height;
            const x2 = canvas.width / 2 - Math.cos(angle) * canvas.width;
            const y2 = canvas.height / 2 - Math.sin(angle) * canvas.height;
            
            const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
            gradient.addColorStop(0, options.startColor);
            gradient.addColorStop(1, options.endColor);
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            break;
        case 'image':
            if (options.src) {
                const img = new Image();
                img.onload = function() {
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    let y = 0;
                    blocks.forEach(block => {
                        block.render(ctx, y);
                        y += block.height;
                    });
                }
                img.src = options.src;
            } else {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
            break;
    }
}

function addBlock() {
    const newBlock = new Block(100, canvas.width);
    newBlock.y = blocks.length > 0 ? blocks[blocks.length - 1].y + blocks[blocks.length - 1].height : 0;
    newBlock.name = `Block${blocks.length + 1}`; // 设置初始name
    // 设置文字类型的字体大小为背景宽度的1/25
    newBlock.fontSize = Math.round(canvas.width / 25);
    
    blocks.push(newBlock);
    updateBlockList(true);
    updatePreview();
    // 添加新Block时折叠背景设置
    const backgroundSettingsToggle = document.getElementById('backgroundSettingsToggle');
    const backgroundSettingsContainer = document.getElementById('backgroundSettingsContainer');
    if (backgroundSettingsToggle && backgroundSettingsContainer) {
        backgroundSettingsToggle.classList.add('collapsed');
        backgroundSettingsContainer.classList.add('collapsed');
        // 更新折叠图标
        const toggleIcon = backgroundSettingsToggle.querySelector('.toggle-icon');
        if (toggleIcon) {
            toggleIcon.textContent = '▶';
        }
    }
}

// 添加字体数组
const availableFonts = [
    // 添加你的自定义字体
    { name:'打字机', value: '打字机'},
    { name:'游趣', value: '游趣'},
    { name:'春风', value: '春风'},
    { name:'扁桃', value: '扁桃'},
    { name:'宫殿', value: '宫殿'},
    { name:'珠圆', value: '珠圆'},
    { name: '仓迹妙黑', value: '仓迹高德国妙黑' },
    { name: '宋体', value: 'SimSun' },
    { name: '黑体', value: 'SimHei' },
    { name: '微软雅黑', value: 'Microsoft YaHei' },
    { name: '楷体', value: 'KaiTi' },
    { name: '仿宋', value: 'FangSong' },
    { name: '落霞孤鹜', value: 'LXGW Marker Gothic' },
    { name: 'Source Han Serif CN', value: 'Source Han Serif CN' },
    { name: 'Arial', value: 'Arial' },
    { name: 'Times New Roman', value: 'Times New Roman' },
];
function updateBlockList(isNewBlock = false) {
    const blockList = document.getElementById('blockList');
    blockList.innerHTML = '';
    blocks.forEach((block, index) => {
        const blockElement = document.createElement('div');
        blockElement.innerHTML = `
            <div class="block">
                <div class="block-header">
                    <h3>${block.name || `Block ${index + 1}`}</h3>
                    <div class="block-controls">
                        <button class="toggle-block-settings">▼</button>
                        <button class="delete-block"> X </button>
                    </div>
                </div>
                <div class="block-settings">
                    <div class="setting-row">
                        <label for="blockName">名称</label>
                        <input type="text" class="block-name" value="${block.name}">
                        <span class="setting-description">设置Block的名称</span>
                    </div>
                    <div class="setting-row">
                        <label for="blockOpacity">透明度</label>
                        <input type="range" class="block-opacity" value="${block.opacity}" min="0" max="1" step="0.1">
                        <span class="opacity-value">${block.opacity.toFixed(1)}</span>
                        <span class="setting-description">设置元素的透明度(0-1)</span>
                    </div>
                    <div class="setting-row">
                        <label for="blockType">类型</label>
                        <select class="blockType">
                            <option value="text" ${block.type === 'text' ? 'selected' : ''}>文本</option>
                            <option value="image" ${block.type === 'image' ? 'selected' : ''}>图片</option>
                        </select>
                        <span class="setting-description">选择此Block的类型</span>
                    </div>
                    <div class="setting-row">
                        <label for="blockY">Y轴位置</label>
                        <input type="number" class="block-y" value="${block.y}" min="0">
                        <span class="setting-description">设置Block的Y坐标</span>
                    </div>
                    <div class="setting-row">
                        <label for="blockHeight">元素高度</label>
                        <input type="number" class="block-height" value="${block.height}" min="10">
                        <span class="setting-description">设置Block的高度</span>
                    </div>
                    <div class="text-settings" ${block.type === 'text' ? '' : 'style="display:none;"'}>
                        <div class="setting-row">
                            <label for="blockContent">内容</label>
                            <textarea class="block-content" rows="3">${block.content}</textarea>
                            <span class="setting-description">输入文本内容（支持换行）</span>
                        </div>
                        <div class="setting-row">
                            <label for="lineHeight">行高</label>
                            <input type="number" class="line-height" value="${block.lineHeight}" min="0.5" max="3" step="0.1">
                            <span class="setting-description">设置文本行高（1.0-3.0）</span>
                        </div>
                        <div class="setting-row">
                            <label for="textAlign">水平对齐</label>
                            <select class="text-align">
                                <option value="left" ${block.textAlign === 'left' ? 'selected' : ''}>左对齐</option>
                                <option value="center" ${block.textAlign === 'center' ? 'selected' : ''}>居中</option>
                                <option value="right" ${block.textAlign === 'right' ? 'selected' : ''}>右对齐</option>
                            </select>
                            <span class="setting-description">设置文本水平对齐方式</span>
                        </div>
                        <div class="setting-row">
                            <label for="verticalAlign">垂直对齐</label>
                            <select class="vertical-align">
                                <option value="top" ${block.verticalAlign === 'top' ? 'selected' : ''}>顶部对齐</option>
                                <option value="middle" ${block.verticalAlign === 'middle' ? 'selected' : ''}>垂直居中</option>
                                <option value="bottom" ${block.verticalAlign === 'bottom' ? 'selected' : ''}>底部对齐</option>
                            </select>
                            <span class="setting-description">设置文本垂直对齐方式</span>
                        </div>
                        <div class="setting-row">
                            <label for="font">字体</label>
                            <select class="font">
                                ${availableFonts.map(font => 
                                    `<option value="${font.value}" style="font-family: '${font.value}', sans-serif;" ${block.font === font.value ? 'selected' : ''}>${font.name}</option>`
                                ).join('')}
                            </select>
                            <span class="setting-description">设置文本字体</span>
                        </div>
                        <div class="setting-row">
                            <label for="fontSize">字体大小</label>
                            <input type="number" class="font-size" value="${block.fontSize}" min="1">
                            <span class="setting-description">设置文本字体大小</span>
                        </div>
                        <div class="setting-row">
                            <label for="textStyle">文本样式</label>
                            <div class="text-style-options">
                                <label>
                                    <input type="checkbox" class="bold-text" ${block.isBold ? 'checked' : ''}> 
                                    <span>粗体</span>
                                </label>
                                <label>
                                    <input type="checkbox" class="italic-text" ${block.isItalic ? 'checked' : ''}> 
                                    <span>斜体</span>
                                </label>
                            </div>
                            <span class="setting-description">设置文本粗体和斜体</span>
                        </div>
                        <div class="setting-row">
                            <label for="textColor">文字颜色</label>
                            <input type="color" class="text-color" value="${block.textColor}">
                            <span class="setting-description">设置文字颜色</span>
                        </div>
                        <div class="setting-row">
                            <label for="xPosition">X坐标</label>
                            <input type="number" class="x-position" value="${block.x}" min="0">
                            <span class="setting-description">设置文本X坐标</span>
                        </div>
                        <div class="setting-row">
                            <label for="contentY">Y坐标</label>
                            <input type="number" class="content-y" value="${block.contentY}" min="0">
                            <span class="setting-description">设置文本Y坐标</span>
                        </div>
                    </div>
                    <div class="image-settings" ${block.type === 'image' ? '' : 'style="display:none;"'}>
                        <div class="setting-row">
                            <label for="imageUpload">上传图片</label>
                            <div class="file-input-wrapper">
                                <input type="text" class="file-name" readonly>
                                <input type="file" class="image-upload" accept="image/*">
                                <button class="file-input-button">浏览..</button>
                            </div>
                            <span class="setting-description">选择要上传的图片</span>
                        </div>
                        <div class="setting-row">
                            <label for="imageWidth">图片宽度</label>
                            <input type="number" class="image-width" value="${block.imageWidth || ''}" min="1">
                            <span class="setting-description">设置图片宽度</span>
                        </div>
                        <div class="setting-row">
                            <label for="imageHeight">图片高度</label>
                            <input type="number" class="image-height" value="${block.imageHeight || ''}" min="1">
                            <span class="setting-description">设置图片高度</span>
                        </div>
                        <div class="setting-row">
                            <label for="xPosition">X坐标</label>
                            <input type="number" class="x-position" value="${block.x}" min="0">
                            <span class="setting-description">设置图片X坐标</span>
                        </div>
                        <div class="setting-row">
                            <label for="contentY">Y坐标</label>
                            <input type="number" class="content-y" value="${block.contentY}" min="0">
                            <span class="setting-description">设置图片Y坐标</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        blockList.appendChild(blockElement);

        // 添加事件监听器
        addBlockEventListeners(blockElement, block, index);
        
        // 添加文件名显示和自定义按钮的功能
        const fileInput = blockElement.querySelector('.image-upload');
        const fileNameDisplay = blockElement.querySelector('.file-name');
        const fileInputButton = blockElement.querySelector('.file-input-button');

        fileInputButton.addEventListener('click', () => {
            fileInput.click();
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                fileNameDisplay.value = e.target.files[0].name;
            }
        });        
        
        // 处理折叠功能
        const blockHeader = blockElement.querySelector('.block-header');
        const blockSettings = blockElement.querySelector('.block-settings');
        const toggleButton = blockElement.querySelector('.toggle-block-settings');
        
        // 如果是新增Block，并且不是最后一个Block，则设置为折叠状态
        if (isNewBlock && index !== blocks.length - 1) {
            block.isCollapsed = true;
        }

        // 根据block的isCollapsed状态设置UI
        if (block.isCollapsed) {
            blockSettings.classList.add('collapsed');
            blockHeader.classList.add('collapsed');
            toggleButton.style.transform = 'rotate(-135deg)';
        }

        blockHeader.addEventListener('click', (e) => {
            // 防止点击删除按钮时触发折叠
            if (e.target.classList.contains('delete-block')) return;
            
            block.isCollapsed = !block.isCollapsed;
            blockHeader.classList.toggle('collapsed');
            blockSettings.classList.toggle('collapsed');
            toggleButton.style.transform = block.isCollapsed ? 'rotate(-135deg)' : 'rotate(0deg)';
        });

        // 添加删除功能
        const deleteButton = blockElement.querySelector('.delete-block');
        deleteButton.addEventListener('click', () => {
            blocks.splice(index, 1);
            updateBlockList();
            updatePreview();
        });
        
        // 添加透明度滑块的事件监听器
        const opacitySlider = blockElement.querySelector('.block-opacity');
        const opacityValue = blockElement.querySelector('.opacity-value');
        opacitySlider.addEventListener('input', function() {
            block.opacity = parseFloat(this.value);
            opacityValue.textContent = block.opacity.toFixed(1);
            updatePreview();
        });
    });
}

function addBlockEventListeners(blockElement, block, index) {
    // 添加事件监听器
    blockElement.querySelector('.blockType').addEventListener('change', (e) => {
        block.type = e.target.value;
        updateBlockSettings(blockElement, block);
        updatePreview();
    });

    blockElement.querySelector('.block-height').addEventListener('input', (e) => {
        block.height = parseInt(e.target.value);
        updatePreview();
    });

    blockElement.querySelector('.block-content').addEventListener('input', (e) => {
        block.content = e.target.value;
        updatePreview();
    });

    blockElement.querySelector('.text-align').addEventListener('change', (e) => {
        block.textAlign = e.target.value;
        updatePreview();
    });

    blockElement.querySelector('.vertical-align').addEventListener('change', (e) => {
        block.verticalAlign = e.target.value;
        updatePreview();
    });

    blockElement.querySelector('.font-size').addEventListener('input', (e) => {
        block.fontSize = parseInt(e.target.value);
        updatePreview();
    });

    blockElement.querySelectorAll('.x-position').forEach(el => {
        el.addEventListener('input', (e) => {
            block.contentX = parseInt(e.target.value); // 修改为contentX
            updatePreview();
        });
    });

    blockElement.querySelectorAll('.y-position').forEach(el => {
        el.addEventListener('input', (e) => {
            block.contentY = parseInt(e.target.value);
            updatePreview();
        });
    });

    blockElement.querySelector('.image-upload').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async function(event) {
                try {
                    await block.loadImage(event.target.result);
                    updateBlockSettings(blockElement, block);
                    updatePreview();
                } catch (error) {
                    console.error('Error loading image:', error);
                }
            }
            reader.readAsDataURL(file);
        }
    });

    blockElement.querySelector('.image-width').addEventListener('input', (e) => {
        block.imageWidth = parseInt(e.target.value);
        updatePreview();
    });

    blockElement.querySelector('.image-height').addEventListener('input', (e) => {
        block.imageHeight = parseInt(e.target.value);
        updatePreview();
    });
    
    blockElement.querySelector('.block-y').addEventListener('input', (e) => {
        block.y = parseInt(e.target.value);
        updatePreview();
    });

    blockElement.querySelectorAll('.content-y').forEach(el => {
        el.addEventListener('input', (e) => {
            block.contentY = parseInt(e.target.value);
            updatePreview();
        });
    });
    // 添加新的事件监听器来处理编辑状态
    blockElement.addEventListener('mouseenter', () => {
        block.isEditing = true;
        updatePreview();
    });

    blockElement.addEventListener('mouseleave', () => {
        block.isEditing = false;
        updatePreview();
    });

    blockElement.querySelector('.blockType').addEventListener('change', (e) => {
        updateBlockSettings(blockElement, block);
    });
    
    blockElement.querySelector('.font').addEventListener('change', (e) => {
        block.font = e.target.value;
        updatePreview();
    });

    blockElement.querySelector('.block-name').addEventListener('input', (e) => {
        block.name = e.target.value;
        // 更新Block头部的显示
        blockElement.querySelector('.block-header h3').textContent = block.name || `Block ${index + 1}`;
        updatePreview();
    });

    blockElement.querySelector('.block-content').addEventListener('input', (e) => {
        block.content = e.target.value;
        updatePreview();
    });

    blockElement.querySelector('.line-height').addEventListener('input', (e) => {
        block.lineHeight = parseFloat(e.target.value);
        updatePreview();
    });
    // 添加图片上传功能
    blockElement.querySelector('.image-upload').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async function(event) {
                try {
                    await block.loadImage(event.target.result);
                    updateBlockSettings(blockElement, block);
                    updatePreview();
                } catch (error) {
                    console.error('Error loading image:', error);
                }
            }
            reader.readAsDataURL(file);
        }
    });
    // 字体粗体、斜体的监听
    blockElement.querySelector('.bold-text').addEventListener('change', (e) => {
        block.isBold = e.target.checked;
        updatePreview();
    });

    blockElement.querySelector('.italic-text').addEventListener('change', (e) => {
        block.isItalic = e.target.checked;
        updatePreview();
    });

    blockElement.querySelector('.text-color').addEventListener('input', (e) => {
        block.textColor = e.target.value;
        updatePreview();
    });
    // 添加透明度滑块的事件监听器
    blockElement.querySelector('.block-opacity').addEventListener('input', (e) => {
        block.opacity = parseFloat(e.target.value);
        blockElement.querySelector('.opacity-value').textContent = block.opacity.toFixed(1);
        updatePreview();
    });
}

function updateBlockSettings(blockElement, block) {
    const oldType = block.type;
    const newType = blockElement.querySelector('.blockType').value;
    block.type = newType;
    
    // 添加图片上传功能
    if (block.type === 'image') {
        blockElement.querySelector('.image-width').value = block.imageWidth || '';
        blockElement.querySelector('.image-height').value = block.imageHeight || '';
    }
    // 初始化新类型的默认值
            if (oldType !== newType) {
            if (newType === 'text') {
                block.content = '新文字块';
                block.textAlign = 'center';
                block.verticalAlign = 'middle';
                block.font = 'Arial';
                block.fontSize = 16;
                block.x = 0;
                block.textColor = '#000000'; // 重置文字颜色为黑色
                //block.contentY = 0; // 重置 contentY

        } else if (newType === 'image') {
            block.image = null;
            block.imageWidth = block.width;
            block.imageHeight = block.height;
            block.x = 0;
            //block.contentY = 0; // 重置 contentY
        }

        // 更新UI中的值
        if (newType === 'text') {
            blockElement.querySelector('.block-content').value = block.content;
            blockElement.querySelector('.text-align').value = block.textAlign;
            blockElement.querySelector('.vertical-align').value = block.verticalAlign;
            blockElement.querySelector('.font').value = block.font;
            blockElement.querySelector('.font-size').value = block.fontSize;
            blockElement.querySelector('.x-position').value = block.x;
            blockElement.querySelector('.x-position').value = block.contentX; // 修改为contentX
            blockElement.querySelector('.content-y').value = block.contentY;
        } else if (newType === 'image') {
            blockElement.querySelector('.image-width').value = block.imageWidth;
            blockElement.querySelector('.image-height').value = block.imageHeight;
            blockElement.querySelector('.x-position').value = block.x;
            blockElement.querySelector('.x-position').value = block.contentX; // 修改为contentX
            blockElement.querySelector('.content-y').value = block.contentY;
            blockElement.querySelector('.image-upload').value = ''; // 清空文件输入
        }
    }
    
    blockElement.querySelector('.text-settings').style.display = block.type === 'text' ? 'block' : 'none';
    blockElement.querySelector('.image-settings').style.display = block.type === 'image' ? 'block' : 'none';
    // 更新预览
    updatePreview();
}

function updatePreview() {
    if (!canvas || !ctx) return;

    // 创建离屏canvas
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = canvas.width;
    offscreenCanvas.height = canvas.height;
    const offscreenCtx = offscreenCanvas.getContext('2d');

    // 在离屏canvas上绘制背景
    drawBackground(offscreenCtx, offscreenCanvas);

    // 在离屏canvas上绘制所有blocks
    blocks.forEach(block => {
        block.render(offscreenCtx);
    });

    // 将离屏canvas的内容复制到主canvas上
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(offscreenCanvas, 0, 0);

    // 计算缩放比例
    const containerWidth = canvas.parentElement.clientWidth;
    const containerHeight = canvas.parentElement.clientHeight;
    const scaleX = (containerWidth * 0.9) / canvas.width;
    const scaleY = (containerHeight * 0.9) / canvas.height;
    const scale = Math.min(scaleX, scaleY, 1);

    // 应用缩放
    canvas.style.width = `${canvas.width * scale}px`;
    canvas.style.height = `${canvas.height * scale}px`;

    // 居中定位
    canvas.style.position = 'absolute';
    canvas.style.left = `${(containerWidth - canvas.width * scale) / 2}px`;
    canvas.style.top = `${(containerHeight - canvas.height * scale) / 2}px`;

    // 显示缩放比例
    const scaleInfo = document.getElementById('scaleInfo');
    if (scaleInfo) {
        scaleInfo.textContent = `缩放比例: ${(scale * 100).toFixed(2)}%`;
    }

    // 如果有生成的图片，显示当前图片
    if (generatedImages.length > 0) {
        showGeneratedImage();
    }
}

function updateBackground() {
    const type = document.getElementById('backgroundType').value;
    switch(type) {
        case 'solid':
            currentBackground.type = 'solid';
            currentBackground.color = document.getElementById('solidColor').value;
            break;
        case 'gradient':
            currentBackground.type = 'gradient';
            currentBackground.gradientStartColor = document.getElementById('gradientStartColor').value;
            currentBackground.gradientEndColor = document.getElementById('gradientEndColor').value;
            currentBackground.gradientAngle = parseInt(document.getElementById('gradientAngle').value);
            // 更新预设下拉菜单
            const presetSelect = document.getElementById('gradientPresets');
            const currentColors = {
                startColor: currentBackground.gradientStartColor,
                endColor: currentBackground.gradientEndColor
            };
            const matchingPreset = Object.keys(gradientPresets).find(key => 
                JSON.stringify(gradientPresets[key]) === JSON.stringify(currentColors)
            );
            presetSelect.value = matchingPreset || '';
            break;
        case 'image':
            currentBackground.type = 'image';
            // 如果背景类型改变为图片，重置backgroundImage
            backgroundImage = null;
            break;
    }
    updatePreview();
}

function updateBackgroundSettings() {
    const type = document.getElementById('backgroundType').value;
    document.getElementById('solidColorSettings').style.display = type === 'solid' ? 'block' : 'none';
    document.getElementById('gradientSettings').style.display = type === 'gradient' ? 'block' : 'none';
    document.getElementById('imageSettings').style.display = type === 'image' ? 'block' : 'none';
    updateBackground();
}

function updateCanvasSize() {
    const width = parseInt(document.getElementById('canvasWidth').value);
    const height = parseInt(document.getElementById('canvasHeight').value);
    const lockAspectRatio = document.getElementById('lockAspectRatio').checked;

    if (width > 0 && height > 0) {
        if (lockAspectRatio) {
            // 根据修改的输入框来调整另一个输入框的值
            if (this.id === 'canvasWidth') {
                document.getElementById('canvasHeight').value = Math.round(width / aspectRatio);
            } else {
                document.getElementById('canvasWidth').value = Math.round(height * aspectRatio);
            }
        }

        canvas.width = parseInt(document.getElementById('canvasWidth').value);
        canvas.height = parseInt(document.getElementById('canvasHeight').value);

        // 更新所有Block的宽度
        blocks.forEach(block => {
            block.width = canvas.width;
        });
        
        updateBlockList(); // 更新Block列表显示
        updatePreview();
    }
}

function handleImageUpload(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                canvas.width = img.width;
                canvas.height = img.height;
                document.getElementById('canvasWidth').value = img.width;
                document.getElementById('canvasHeight').value = img.height;
                currentBackground.imageSrc = event.target.result;
                currentBackground.type = 'image';
                
                // 更新所有Block的宽度
                blocks.forEach(block => {
                    block.width = canvas.width;
                });
                
                updateBackground();
                updateBlockList(); // 更新Block列表显示
                updatePreview();
            }
            img.src = event.target.result;
        }
        reader.readAsDataURL(file);
    }
}

function init() {
    canvas = document.getElementById('imageCanvas');
    ctx = canvas.getContext('2d');

    const backgroundTypeSelect = document.getElementById('backgroundType');
    const defaultBackgroundType = backgroundTypeSelect.options[0].value;

    currentBackground = {
        type: defaultBackgroundType,
        color: document.getElementById('solidColor').value,
        gradientStartColor: document.getElementById('gradientStartColor').value,
        gradientEndColor: document.getElementById('gradientEndColor').value,
        gradientAngle: parseInt(document.getElementById('gradientAngle').value),
        imageSrc: null
    };

    canvas.width = parseInt(document.getElementById('canvasWidth').value);
    canvas.height = parseInt(document.getElementById('canvasHeight').value);

    // 设置背景类型为默认值（第一个选项）
    backgroundTypeSelect.value = defaultBackgroundType;

    updateBackgroundSettings();

    // 生成渐变预设按钮
    const presetContainer = document.getElementById('gradientPresets');
    for (const [key, preset] of Object.entries(gradientPresets)) {
        const button = document.createElement('button');
        button.className = 'preset-button';
        button.dataset.preset = key;
        button.title = preset.name;
        button.style.background = `linear-gradient(to right, ${preset.endColor}, ${preset.startColor})`;
        
        button.addEventListener('click', function() {
            updateGradientPreset(key);
        });
        
        presetContainer.appendChild(button);
    }
    
    // 统一处理所有设置部分的折叠/展开功能
    const settingsToggles = [
        { toggle: 'backgroundSettingsToggle', container: 'backgroundSettingsContainer', label: '背景设置' },
        { toggle: 'blockListToggle', container: 'blockListContainer', label: '元素列表' },
        { toggle: 'templateSettingsToggle', container: 'templateSettingsContainer', label: '模板设置' },
        { toggle: 'batchGenerationToggle', container: 'batchGenerationContainer', label: '批量生成' }
    ];

    settingsToggles.forEach(({ toggle, container, label }) => {
        const toggleElement = document.getElementById(toggle);
        const containerElement = document.getElementById(container);
        if (toggleElement && containerElement) {
            toggleElement.innerHTML = `
                <span>${label}</span>
                <span class="toggle-icon">▼</span>
            `;
            toggleElement.addEventListener('click', function() {
                toggleElement.classList.toggle('collapsed');
                containerElement.classList.toggle('collapsed');
                // 特殊处理模板设置
                if (container === 'templateSettingsContainer') {
                    const compactSettings = containerElement.querySelector('.compact-template-settings');
                    if (compactSettings) {
                        compactSettings.classList.toggle('collapsed');
                    }
                }
                const toggleIcon = toggleElement.querySelector('.toggle-icon');
                if (toggleIcon) {
                    toggleIcon.textContent = toggleElement.classList.contains('collapsed') ? '▶' : '▼';
                }
            });

            // 初始化时折叠模板设置和批量生成
            if (toggle === 'templateSettingsToggle' || toggle === 'batchGenerationToggle') {
                toggleElement.classList.add('collapsed');
                containerElement.classList.add('collapsed');
                if (container === 'templateSettingsContainer') {
                    const compactSettings = containerElement.querySelector('.compact-template-settings');
                    if (compactSettings) {
                        compactSettings.classList.add('collapsed');
                    }
                }
                const toggleIcon = toggleElement.querySelector('.toggle-icon');
                if (toggleIcon) {
                    toggleIcon.textContent = '▶';
                }
            }
        }
    });
     
    const scaleInfo = document.createElement('div');
    scaleInfo.id = 'scaleInfo';
    scaleInfo.style.position = 'absolute';
    scaleInfo.style.top = '10px';
    scaleInfo.style.left = '10px';
    scaleInfo.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    scaleInfo.style.color = 'white';
    scaleInfo.style.padding = '5px';
    scaleInfo.style.borderRadius = '3px';
    document.querySelector('.image-preview').appendChild(scaleInfo);

    updatePreview();

    // 添加事件监听器
    document.getElementById('addBlock').addEventListener('click', addBlock);
    document.getElementById('backgroundType').addEventListener('change', updateBackgroundSettings);
    document.getElementById('solidColor').addEventListener('input', updateBackground);
    document.getElementById('gradientStartColor').addEventListener('input', updateBackground);
    document.getElementById('gradientEndColor').addEventListener('input', updateBackground);
    document.getElementById('gradientAngle').addEventListener('input', updateBackground);
    document.getElementById('canvasWidth').addEventListener('input', updateCanvasSize);
    document.getElementById('canvasHeight').addEventListener('input', updateCanvasSize);
    document.getElementById('backgroundImage').addEventListener('change', handleImageUpload);
    
    // 添加新的事件监听器
    document.getElementById('saveTemplate').addEventListener('click', saveTemplate);
    document.getElementById('templateList').addEventListener('change', loadTemplate);
    document.getElementById('deleteTemplate').addEventListener('click', deleteTemplate);
    
    // 添加重命名模板的事件监听器
    document.getElementById('renameTemplate').addEventListener('click', renameTemplate);
    // 添加导出模板的事件监听器
    document.getElementById('exportTemplate').addEventListener('click', exportTemplate);
    // 添加导入模板的事件监听器
    document.getElementById('importTemplate').addEventListener('click', importTemplate);
    // 添加下载按钮的事件监听器
    document.getElementById('downloadButton').addEventListener('click', downloadImage);  
    // 从localStorage加载已保存的模板
    loadTemplatesFromStorage();
    
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(updatePreview, 250);
    });

    // 添加批量生成的事件监听器
    document.getElementById('exportCSV').addEventListener('click', () => exportTextBlocks('csv'));
    document.getElementById('exportJSON').addEventListener('click', () => exportTextBlocks('json'));
    document.getElementById('importButton').addEventListener('click', () => document.getElementById('importFile').click());
    document.getElementById('importFile').addEventListener('change', (e) => importData(e.target.files[0]));
    document.getElementById('prevImage').addEventListener('click', () => {
        if (currentImageIndex > 0) {
            currentImageIndex--;
            updatePreviewControls();
            showGeneratedImage();
        }
    });
    document.getElementById('nextImage').addEventListener('click', () => {
        if (currentImageIndex < generatedImages.length - 1) {
            currentImageIndex++;
            updatePreviewControls();
            showGeneratedImage();
        }
    });

    // 添加批量下载按钮的事件监听器
    document.getElementById('batchDownload').addEventListener('click', batchDownload);

    // 添加新的渐变预设按钮事件监听器
    const presetButtons = document.querySelectorAll('.preset-button');
    presetButtons.forEach(button => {
        button.addEventListener('click', function() {
            updateGradientPreset(this.dataset.preset);
        });
    });
    
    // 修改现有的事件监听器
    document.getElementById('gradientStartColor').addEventListener('input', () => updateGradientPreset('custom'));
    document.getElementById('gradientEndColor').addEventListener('input', () => updateGradientPreset('custom'));
    // 确保在页面加载时调用一次 updateGradientPreset
    updateGradientPreset();

    // 初始化宽高比
    aspectRatio = canvas.width / canvas.height;

    // 添加锁定比例复选框的事件监听器
    document.getElementById('lockAspectRatio').addEventListener('change', updateAspectRatioLock);
}

// 修改updateGradientPreset函数
function updateGradientPreset(preset) {
    const startColorInput = document.getElementById('gradientStartColor');
    const endColorInput = document.getElementById('gradientEndColor');
    
    // 移除所有按钮的active类
    document.querySelectorAll('.preset-button').forEach(btn => btn.classList.remove('active'));
    
    if (preset && gradientPresets[preset]) {
        startColorInput.value = gradientPresets[preset].startColor;
        endColorInput.value = gradientPresets[preset].endColor;
        
        // 添加active类到选中的按钮
        document.querySelector(`.preset-button[data-preset="${preset}"]`).classList.add('active');
    }
    
    updateBackground();
}

// 保存模板
// 修改保存模板函数
function saveTemplate() {
    const templateList = document.getElementById('templateList');
    const currentTemplate = templateList.value;

    if (!currentTemplate) {
        // 如果未使用模板，弹出输入框要求输入模板名字
        const templateName = prompt('请输入新模板名称：');
        if (templateName === null) return; // 用户取消输入
        if (templateName.trim() === '') {
            alert('模板名称不能为空');
            return;
        }
        saveTemplateWithName(templateName.trim());
    } else {
        // 如果使用了模板，弹出选择框
        const choice = confirm(`是否要覆盖现有模板 "${currentTemplate}"？\n点击"确定"覆盖，点击"取消"另存为新模板。`);
        if (choice) {
            // 覆盖现有模板
            saveTemplateWithName(currentTemplate);
        } else {
            // 另存为新模板
            const newTemplateName = prompt('请输入新模板名称：');
            if (newTemplateName === null) return; // 用户取消输入
            if (newTemplateName.trim() === '') {
                alert('模板名称不能为空');
                return;
            }
            saveTemplateWithName(newTemplateName.trim());
        }
    }
}

// 新增函数：使用指定名称保存模板
function saveTemplateWithName(templateName) {
    const template = {
        background: {
            type: currentBackground.type,
            color: currentBackground.color,
            gradientStartColor: currentBackground.gradientStartColor,
            gradientEndColor: currentBackground.gradientEndColor,
            gradientAngle: currentBackground.gradientAngle,
            imageSrc: currentBackground.imageSrc
        },
        blocks: blocks.map(b => {
            const blockData = {...b};
            if (b.type === 'image' && b.image) {
                blockData.image = {
                    src: b.image.src,
                    width: b.image.width,
                    height: b.image.height
                };
            }
            return blockData;
        }),
        canvasWidth: canvas.width,
        canvasHeight: canvas.height
    };
    
    templates[templateName] = template;
    updateTemplateList();
    saveTemplatesToStorage();
    
    // 更新选择框的选中项
    const templateList = document.getElementById('templateList');
    templateList.value = templateName;
    
    //alert(`模板 "${templateName}" 保存成功`);
}

function loadTemplate() {
    const templateName = document.getElementById('templateList').value;
    if (!templateName) return;
    
    const template = templates[templateName];
    if (!template) return;
    
    // 加载背景设置
    currentBackground = {...template.background};
    document.getElementById('backgroundType').value = currentBackground.type;
    document.getElementById('solidColor').value = currentBackground.color;
    document.getElementById('gradientStartColor').value = currentBackground.gradientStartColor;
    document.getElementById('gradientEndColor').value = currentBackground.gradientEndColor;
    document.getElementById('gradientAngle').value = currentBackground.gradientAngle;
    
    // 如果是图片背景，需要额外处理
    if (currentBackground.type === 'image' && currentBackground.imageSrc) {
        const img = new Image();
        img.onload = function() {
            updateBackgroundSettings();
            updatePreview();
        }
        img.src = currentBackground.imageSrc;
    }
    
    blocks = template.blocks.map(b => {
        const newBlock = new Block(b.height, b.width);
        Object.assign(newBlock, b);
        if (b.type === 'image' && b.image) {
            newBlock.loadImage(b.image.src).then(() => {
                updateBlockList();
                updatePreview();
            });
        }
        return newBlock;
    });
    
    canvas.width = template.canvasWidth;
    canvas.height = template.canvasHeight;
    
    document.getElementById('canvasWidth').value = canvas.width;
    document.getElementById('canvasHeight').value = canvas.height;
    
    updateBackgroundSettings();
    updateBlockList();
    updatePreview();
}

// 修改updateTemplateList函数,为每个选项添加删除按钮
function updateTemplateList() {
    const templateList = document.getElementById('templateList');
    templateList.innerHTML = '<option value="">选择模板</option>';
    
    for (const name in templates) {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        templateList.appendChild(option);
    }
}

// 保存模板到localStorage
function saveTemplatesToStorage() {
    localStorage.setItem('imageEditorTemplates', JSON.stringify(templates));
}

// 从localStorage加载模板
function loadTemplatesFromStorage() {
    const storedTemplates = localStorage.getItem('imageEditorTemplates');
    if (storedTemplates) {
        templates = JSON.parse(storedTemplates);
        updateTemplateList();
    }
}

// 添加删除模板的函数
function deleteTemplate() {
    const templateName = document.getElementById('templateList').value;
    if (!templateName) {
        alert('请先选择要删除的模板');
        return;
    }
    
    if (confirm(`确定要删除模板 "${templateName}" 吗?`)) {
        delete templates[templateName];
        updateTemplateList();
        saveTemplatesToStorage();
        //alert('模板已删除');
        
        // 清空选择
        document.getElementById('templateList').value = '';
    }
}

// 添加重命名模板的函数
function renameTemplate() {
    const templateList = document.getElementById('templateList');
    const currentTemplate = templateList.value;
    
    if (!currentTemplate) {
        alert('请先选择要重命名的模板');
        return;
    }
    
    const newName = prompt(`请输入 "${currentTemplate}" 的新名称:`, currentTemplate);
    
    if (newName === null) return; // 用户取消输入
    
    if (newName.trim() === '') {
        alert('模板名称不能为空');
        return;
    }
    
    if (newName === currentTemplate) {
        alert('新名称与原名称相同,无需更改');
        return;
    }
    
    if (templates[newName]) {
        alert('该名称已存在,请使用其他名称');
        return;
    }
    
    // 重命名模板
    templates[newName] = templates[currentTemplate];
    delete templates[currentTemplate];
    
    updateTemplateList();
    saveTemplatesToStorage();
    
    // 更新选择框的选中项
    templateList.value = newName;
    
    alert(`模板已重命名为 "${newName}"`);
}

function exportTemplate() {
    const templateName = document.getElementById('templateList').value;
    if (!templateName) {
        alert('请先选择要导出的模板');
        return;
    }

    const template = templates[templateName];
    const exportData = {
        name: templateName,
        template: template
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", templateName + ".json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

// 添加导入模板功能
function importTemplate() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = function(event) {
        const file = event.target.files[0];
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const importedData = JSON.parse(e.target.result);
                const templateName = importedData.name;
                const template = importedData.template;

                // 处理图片背景
                if (template.background.type === 'image' && template.background.imageSrc) {
                    const img = new Image();
                    img.onload = function() {
                        template.background.imageSrc = img.src;
                        finalizeImport(templateName, template);
                    }
                    img.src = template.background.imageSrc;
                } else {
                    finalizeImport(templateName, template);
                }
            } catch (error) {
                alert('导入失败：无效的模板文件');
                console.error('Import error:', error);
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

function finalizeImport(templateName, template) {
    // 处理 Block 中的图片
    const promises = template.blocks.map(block => {
        if (block.type === 'image' && block.image && block.image.src) {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = function() {
                    block.image = img;
                    resolve();
                }
                img.src = block.image.src;
            });
        }
        return Promise.resolve();
    });

    Promise.all(promises).then(() => {
        if (templates[templateName]) {
            const newName = prompt(`模板 "${templateName}" 已存在。请输入新名称：`, templateName);
            if (newName && newName !== templateName) {
                templateName = newName;
            } else if (!newName) {
                return; // 用户取消了操作
            }
        }

        templates[templateName] = template;
        updateTemplateList();
        saveTemplatesToStorage();
        alert(`模板 "${templateName}" 导入成功`);
    });
}

// 添加下载图片的函数
function downloadImage() {
    const canvas = document.getElementById('imageCanvas');
    const dataURL = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    
    // 获取当前选中的模板名称
    const templateName = document.getElementById('templateList').value || 'untitled';
    
    // 获取当前时间并格式化
    const now = new Date();
    const timestamp = now.getFullYear() +
                      ('0' + (now.getMonth() + 1)).slice(-2) +
                      ('0' + now.getDate()).slice(-2) +
                      ('0' + now.getHours()).slice(-2) +
                      ('0' + now.getMinutes()).slice(-2) +
                      ('0' + now.getSeconds()).slice(-2);
    
    // 组合文件名
    const fileName = `model_${templateName}_${timestamp}.png`;
    
    link.download = fileName;
    link.href = dataURL;
    link.click();
}
// 240927： 添加批量生成功能
function exportTextBlocks(format) {
    const textBlocks = blocks.filter(block => block.type === 'text');
    const keys = blocks.map((block, index) => 
        block.type === 'text' ? `${index + 1}_${block.name}` : null
    ).filter(key => key !== null);

    // 获取当前选中的模板名称
    const templateName = document.getElementById('templateList').value || 'untitled';
    
    // 获取当前时间并格式化
    const now = new Date();
    const timestamp = now.getFullYear() +
                      ('0' + (now.getMonth() + 1)).slice(-2) +
                      ('0' + now.getDate()).slice(-2);

    if (format === 'csv') {
        // CSV 导出逻辑
        let csvContent = keys.join(',') + '\n';
        csvContent += keys.map(key => textBlocks[keys.indexOf(key)].content).join(',');
        const fileName = `卡片模板_${templateName}_${timestamp}.csv`;
        downloadFile(csvContent, fileName, 'text/csv;charset=utf-8;');
    } else if (format === 'json') {
        // JSON 导出逻辑保持不变
        const jsonData = [
            textBlocks.reduce((obj, block, index) => {
                obj[keys[index]] = block.content;
                return obj;
            }, {})
        ];
        const json = JSON.stringify(jsonData, null, 2);
        const fileName = `卡片模板_${templateName}_${timestamp}.json`;
        downloadFile(json, fileName, 'application/json');
    }
}

function downloadFile(content, fileName, contentType) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
}

function importData(file) {
    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            let data;
            if (file.name.endsWith('.csv')) {
                data = parseCSV(event.target.result);
            } else if (file.name.endsWith('.json')) {
                data = JSON.parse(event.target.result);
                // 确保数据是数组形式
                if (!Array.isArray(data)) {
                    data = [data]; // 如果不是数组，将其转换为单元素数组
                }
            } else {
                throw new Error('不支持的文件格式');
            }
            if (data.length === 0) {
                throw new Error('没有有效的数据');
            }
            generateImages(data);
        } catch (error) {
            alert(`导入失败: ${error.message}`);
            console.error('Import error:', error);
        }
    };
    reader.onerror = function() {
        alert('读取文件时发生错误');
    };
    reader.readAsText(file);
}
function parseCSV(csv) {
    const lines = csv.split('\n').filter(line => line.trim() !== '');
    if (lines.length === 0) {
        throw new Error('CSV 文件为空或格式不正确');
    }
    const headers = lines[0].split(',').map(header => header.trim());
    return lines.slice(1).map(line => {
        const values = line.split(',').map(value => value.trim());
        if (values.length !== headers.length) {
            console.warn(`跳过不完整的行: ${line}`);
            return null;
        }
        return headers.reduce((obj, header, index) => {
            obj[header] = values[index] || '';
            return obj;
        }, {});
    }).filter(item => item !== null);
}

function generateImages(data) {
    generatedImages = [];
    const imagePromises = data.map((item, dataIndex) => {
        return new Promise(async (resolve) => {
            const newBlocks = await Promise.all(blocks.map(async (block, index) => {
                const newBlock = new Block(block.height, block.width);
                Object.assign(newBlock, JSON.parse(JSON.stringify(block)));
                if (newBlock.type === 'text') {
                    // ... existing code ...
                } else if (newBlock.type === 'image' && block.image) {
                    await newBlock.loadImage(block.image.src);
                }
                return newBlock;
            }));

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width;
            tempCanvas.height = canvas.height;
            const tempCtx = tempCanvas.getContext('2d');

            // 绘制背景
            drawBackground(tempCtx, tempCanvas);

            // 创建一个Promise数组来处理所有图片加载
            const blockPromises = newBlocks.map(block => {
                return new Promise((blockResolve) => {
                    if (block.type === 'image' && block.image) {
                        block.image.onload = () => {
                            block.render(tempCtx);
                            blockResolve();
                        };
                        block.image.onerror = () => {
                            console.error('图片加载失败:', block.image.src);
                            blockResolve();
                        };
                    } else {
                        block.render(tempCtx);
                        blockResolve();
                    }
                });
            });

            // 等待所有block渲染完成
            Promise.all(blockPromises).then(() => {
                generatedImages[dataIndex] = tempCanvas.toDataURL('image/png');
                resolve();
            });
        });
    });

    // 等待所有图片生成完成
    Promise.all(imagePromises).then(() => {
        currentImageIndex = 0;
        updatePreviewControls();
        showGeneratedImage();
    });
}

function updatePreviewControls() {
    const previewControls = document.getElementById('previewControls');
    const imageCounter = document.getElementById('imageCounter');
    const prevButton = document.getElementById('prevImage');
    const nextButton = document.getElementById('nextImage');

    if (generatedImages.length > 0) {
        previewControls.style.display = 'flex';
        imageCounter.textContent = `${currentImageIndex + 1} / ${generatedImages.length}`;
        prevButton.disabled = currentImageIndex === 0;
        nextButton.disabled = currentImageIndex === generatedImages.length - 1;
    } else {
        previewControls.style.display = 'none';
    }
}

function drawBackground(ctx, canvas) {
    switch(currentBackground.type) {
        case 'solid':
            ctx.fillStyle = currentBackground.color;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            break;
        case 'gradient':
            const angle = currentBackground.gradientAngle * Math.PI / 180;
            const x1 = canvas.width / 2 + Math.cos(angle) * canvas.width;
            const y1 = canvas.height / 2 + Math.sin(angle) * canvas.height;
            const x2 = canvas.width / 2 - Math.cos(angle) * canvas.width;
            const y2 = canvas.height / 2 - Math.sin(angle) * canvas.height;
            
            const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
            gradient.addColorStop(0, currentBackground.gradientStartColor);
            gradient.addColorStop(1, currentBackground.gradientEndColor);
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            break;
        case 'image':
            if (currentBackground.imageSrc) {
                if (!backgroundImage) {
                    backgroundImage = new Image();
                    backgroundImage.onload = function() {
                        ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
                        updatePreview();
                    }
                    backgroundImage.src = currentBackground.imageSrc;
                } else {
                    ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
                }
            }
            break;
    }
}

function showGeneratedImage() {
    if (generatedImages.length > 0) {
        const img = new Image();
        img.onload = function() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
        };
        img.src = generatedImages[currentImageIndex];
    }
}

function batchDownload() {
    if (generatedImages.length === 0) {
        alert('没有可下载的图片。请先导入数据并生成图片。');
        return;
    }

    // 创建一个zip文件
    const zip = new JSZip();

    // 获取当前选中的模板名称
    const templateName = document.getElementById('templateList').value || 'untitled';
    
    // 获取当前时间并格式化
    const now = new Date();
    const timestamp = now.getFullYear() +
                      ('0' + (now.getMonth() + 1)).slice(-2) +
                      ('0' + now.getDate()).slice(-2) +
                      ('0' + now.getHours()).slice(-2) +
                      ('0' + now.getMinutes()).slice(-2) +
                      ('0' + now.getSeconds()).slice(-2);

    // 添加每个图片到zip文件
    generatedImages.forEach((dataUrl, index) => {
        const fileName = `model_${templateName}_${timestamp}_${index + 1}.png`;
        const data = dataUrl.split(',')[1];
        zip.file(fileName, data, {base64: true});
    });

    // 生成并下载zip文件
    zip.generateAsync({type:"blob"}).then(function(content) {
        const zipFileName = `model_${templateName}_${timestamp}.zip`;
        saveAs(content, zipFileName);
    });
}

function updateAspectRatioLock() {
    const lockAspectRatio = document.getElementById('lockAspectRatio').checked;
    if (lockAspectRatio) {
        aspectRatio = canvas.width / canvas.height;
    }
}


// 获取模态框元素
const modal = document.getElementById("instructionsModal");

// 获取打开模态框的按钮
const btn = document.getElementById("instructionsButton");

// 获取关闭模态框的 <span> 元素
const span = document.getElementsByClassName("close")[0];

// 当用户点击按钮时，打开模态框
btn.onclick = function() {
    modal.style.display = "block";
}

// 当用户点击 <span> (x), 关闭模态框
span.onclick = function() {
    modal.style.display = "none";
}

// 当用户点击模态框外部时，关闭它
window.onclick = function(event) {
    if (event.target == modal) {
        modal.style.display = "none";
    }
}

// 获取联系我们按钮和模态框
const contactButton = document.getElementById('contactButton');
const contactModal = document.getElementById('contactModal');

// 点击联系我们按钮时显示模态框
contactButton.onclick = function() {
    contactModal.style.display = "block";
}

// 为联系我们模态框添加关闭功能
contactModal.querySelector('.close').onclick = function() {
    contactModal.style.display = "none";
}

// 点击模态框外部时关闭
window.onclick = function(event) {
    if (event.target == instructionsModal) {
        instructionsModal.style.display = "none";
    }
    if (event.target == contactModal) {
        contactModal.style.display = "none";
    }
}

document.addEventListener('DOMContentLoaded', init);