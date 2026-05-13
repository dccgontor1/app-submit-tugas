/**
 * site-sync.js
 * Synchronizes global settings like Site Name across all pages.
 */
(function() {
    const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? '/mafatype/backend-php/api.php?action=global-settings'
        : '../backend-php/api.php?action=global-settings';

    async function syncSiteSettings() {
        // Try to get from sessionStorage first to avoid flicker/extra requests
        let settings = JSON.parse(sessionStorage.getItem('global_settings') || 'null');
        
        if (!settings) {
            try {
                // Adjust path based on current location
                let path = window.location.pathname;
                let adjustedApiUrl = API_URL;
                if (path.includes('/frontend/')) {
                    adjustedApiUrl = '../backend-php/api.php?action=global-settings';
                } else if (!path.endsWith('/') && !path.includes('.')) {
                    // Root or something else
                    adjustedApiUrl = 'backend-php/api.php?action=global-settings';
                }

                const response = await fetch(adjustedApiUrl);
                const data = await response.json();
                if (data.settings) {
                    settings = data.settings;
                    sessionStorage.setItem('global_settings', JSON.stringify(settings));
                }
            } catch (e) {
                console.warn('Failed to sync site settings:', e);
                // Fallback
                settings = { site_name: 'Mafatype.' };
            }
        }

        if (settings && settings.site_name) {
            applySiteName(settings.site_name);
        }
        if (settings && settings.site_base_color) {
            applyBaseColor(settings.site_base_color);
        }
        if (settings && settings.site_logo) {
            applySiteLogo(settings.site_logo);
        }
    }

    function applyBaseColor(color) {
        if (!color) return;
        const root = document.documentElement;
        root.style.setProperty('--primary', color);
        
        // Generate variations
        const hex = color.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);

        // RGB components for transparency use cases
        root.style.setProperty('--primary-rgb', `${r}, ${g}, ${b}`);

        // Hover: Darken by ~10%
        const darken = (c) => Math.max(0, Math.floor(c * 0.9));
        const hoverColor = `rgb(${darken(r)}, ${darken(g)}, ${darken(b)})`;
        root.style.setProperty('--primary-h', hoverColor);
        root.style.setProperty('--primary-hover', hoverColor);

        // Light: Lighten/Transparency
        const lightColor = `rgba(${r}, ${g}, ${b}, 0.15)`;
        root.style.setProperty('--primary-light', `rgb(${Math.min(255, r + 40)}, ${Math.min(255, g + 40)}, ${Math.min(255, b + 40)})`);

        // Accent: Shift hue or just lighten significantly for the gradient end
        // For simplicity, let's just make it a lighter version for the gradient
        const accentR = Math.min(255, r + 60);
        const accentG = Math.min(255, g + 60);
        const accentB = Math.max(0, b - 20); // Slight shift towards warmer or cooler
        const accentColor = `rgb(${accentR}, ${accentG}, ${accentB})`;
        root.style.setProperty('--accent', accentColor);

        // Gradient
        root.style.setProperty('--grad', `linear-gradient(135deg, ${color} 0%, ${accentColor} 100%)`);
    }

    function applySiteLogo(logoUrl) {
        if (!logoUrl) return;
        
        let finalUrl = logoUrl;
        if (window.location.pathname.includes('/frontend/')) {
            finalUrl = '../' + logoUrl;
        }

        // 1. Update elements with class .site-logo-img
        document.querySelectorAll('.site-logo-img').forEach(el => {
            el.src = finalUrl;
            el.style.display = 'block';
        });

        // 2. Handle standard logo containers (Admin Sidebar, Login Page, Navbar)
        const selectors = ['.sidebar-brand .logo', '.logo', '.brand-logo', '.nav-brand'];
        selectors.forEach(selector => {
            const containers = document.querySelectorAll(selector);
            containers.forEach(container => {
                if (container.classList.contains('site-logo-img')) return;
                
                // If it already has an injected logo, just update the src
                let img = container.querySelector('.injected-logo');
                if (img) {
                    img.src = finalUrl;
                } else {
                    // Create new logo image
                    img = document.createElement('img');
                    img.src = finalUrl;
                    img.className = 'injected-logo';
                    
                    if (container.classList.contains('nav-brand')) {
                        // Navbar: replace the emoji prefix but keep the site-name-text
                        // Example structure: ⌨️ <span class="site-name-text">Mafatype.</span>
                        // We replace the leading text node (the emoji)
                        const firstChild = container.firstChild;
                        if (firstChild && firstChild.nodeType === 3) {
                            container.insertBefore(img, firstChild);
                            firstChild.remove();
                        } else {
                            container.prepend(img);
                        }
                    } else if (container.classList.contains('brand-logo')) {
                        // Login page big logo: replace content
                        container.innerHTML = '';
                        container.appendChild(img);
                    } else {
                        // Other containers: replace content
                        container.innerHTML = '';
                        container.appendChild(img);
                        container.style.background = 'transparent';
                    }
                }
            });
        });
    }

    function applySiteName(name) {
        // 1. Update document title
        // If title is "Mafatype. - Dashboard", it becomes "MyName - Dashboard"
        const currentTitle = document.title;
        if (currentTitle.includes('Mafatype.')) {
            document.title = currentTitle.replace('Mafatype.', name);
        } else if (!currentTitle.startsWith(name)) {
            // If it doesn't contain the old name, maybe it's completely different, 
            // but usually we want the site name to be there.
            // For now, only replace if "Mafatype." is found.
        }

        // 2. Update elements with class .site-name-text
        document.querySelectorAll('.site-name-text').forEach(el => {
            el.textContent = name;
        });

        // 3. Update specific hardcoded IDs if they exist
        const brandText = document.querySelector('.brand-text');
        if (brandText && brandText.textContent.trim() === 'Mafatype.') {
            brandText.textContent = name;
        }
        
        const logoText = document.querySelector('.logo-text');
        if (logoText && logoText.textContent.trim() === 'Mafatype.') {
            logoText.textContent = name;
        }
    }

    // Run immediately
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', syncSiteSettings);
    } else {
        syncSiteSettings();
    }

    // Special case for admin panel: refresh when settings saved
    window.addEventListener('settings-saved', () => {
        sessionStorage.removeItem('global_settings');
        syncSiteSettings();
    });

})();
