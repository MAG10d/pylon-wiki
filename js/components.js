// Web Components - 原生瀏覽器支援，無需框架

// 左側導航組件
class PylonNav extends HTMLElement {
    connectedCallback() {
        const activePage = this.getAttribute('active') || '';
        // 判斷是否在首頁（根目錄）
        const isIndexPage = activePage === 'index';
        const prefix = isIndexPage ? '' : '../';
        
        this.innerHTML = `
        <aside class="sidebar">
            <div class="sidebar-header">
                <a href="${isIndexPage ? './' : '../'}" class="logo">
                    <span class="logo-icon"></span>
                    Pylon Base
                </a>
            </div>
            <nav>
                <ul class="nav-links">
                    <li><a href="${isIndexPage ? './' : '../'}" ${activePage === 'index' ? 'class="active"' : ''}>首頁</a></li>
                    
                    <div class="nav-section">
                        <div class="nav-section-title">內容</div>
                        <li class="sub-menu">
                            <a href="${prefix}items/" ${activePage === 'items' ? 'class="active"' : ''}>物品系統</a>
                        </li>
                        <li class="sub-menu">
                            <a href="${prefix}machines/" ${activePage === 'machines' ? 'class="active"' : ''}>機器與多方塊</a>
                        </li>
                        <li class="sub-menu">
                            <a href="${prefix}recipes/" ${activePage === 'recipes' ? 'class="active"' : ''}>配方系統</a>
                        </li>
                    </div>
                    
                    <div class="nav-section">
                        <div class="nav-section-title">指南</div>
                        <li class="sub-menu">
                            <a href="${prefix}guide/" ${activePage === 'guide' ? 'class="active"' : ''}>玩法指南</a>
                        </li>
                        <li class="sub-menu">
                            <a href="${prefix}install/" ${activePage === 'install' ? 'class="active"' : ''}>安裝指南</a>
                        </li>
                    </div>
                </ul>
            </nav>
            <div class="external-links">
                <a href="https://pylonmc.github.io/" target="_blank">官方網站</a>
                <a href="https://discord.gg/4tMAnBAacW" target="_blank">Discord 社群</a>
                <a href="https://github.com/PylonMC" target="_blank">GitHub</a>
            </div>
        </aside>
        `;
    }
}

// Footer 組件
class PylonFooter extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `
        <footer>
            <p style="font-size: 0.9rem; color: var(--text-light);">
                <strong>非官方教學文檔</strong> - 由社群玩家製作<br>
                Pylon Base 是 <a href="https://github.com/PylonMC" target="_blank" style="color: var(--teal);">PylonMC</a> 開發的開源插件
            </p>
            <p style="margin-top: 0.5rem; font-size: 0.85rem; color: var(--text-light);">
                本網站使用 <a href="https://github.com/pylonmc/pylon-resource-pack" target="_blank" style="color: var(--teal);">Pylon Resource Pack</a>（LGPL-3.0）提供的圖片和模型<br>
                <a href="LICENSE_NOTICE.md" style="color: var(--teal);">版權聲明</a> | 本網站非官方文檔，僅供玩家參考學習使用
            </p>
        </footer>
        `;
    }
}

customElements.define('pylon-nav', PylonNav);
customElements.define('pylon-footer', PylonFooter);