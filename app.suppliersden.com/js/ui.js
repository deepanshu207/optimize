// UI components for Meesho Shipping Optimizer v6.0.0

const OptimizerUI = {
  // Create modal HTML
  createModalHTML: function (isLicensed) {
    const styles = `
            <style>
                .opt-modal * { box-sizing: border-box; font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif; }
                .opt-modal {  color: black; border-radius: 16px; }
                .opt-header { background: linear-gradient(135deg, #FFD700, #C9A227); padding: 18px 22px; border-radius: 16px 16px 0 0; display: flex; justify-content: space-between; align-items: center; }
                .opt-header h2 { margin: 0; font-size: 18px; font-weight: 700; color: white; display: flex; align-items: center; gap: 10px; }
                .opt-close { background: rgba(255,255,255,0.2); border: none; color: white; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 18px; }
                .opt-close:hover { background: rgba(255,255,255,0.3); }
                .opt-body { padding: 20px;background:white; }
                .opt-section { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 15px; margin-bottom: 15px; }
                .opt-section-title { font-size: 13px; font-weight: 600; color: #a78bfa; margin-bottom: 10px; }
                .opt-label { display: block; font-size: 11px; color: #9ca3af; margin-bottom: 5px; }
                .opt-select, .opt-input { width: 100%; padding: 10px 12px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: black; font-size: 13px; }
                .opt-select:focus, .opt-input:focus { outline: none; border-color: #667eea; }
                .opt-select option { background: #ffffff; }
                .opt-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
                .opt-btn { padding: 12px 20px; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
                .opt-btn-primary { background: linear-gradient(135deg, #FFD700, #C9A227); color: white; }
                .opt-btn-success { background: linear-gradient(135deg, #FFD700, #C9A227); color: white; }
                .opt-btn-danger { background: #ef4444; color: white; }
                .opt-btn-secondary { background: rgba(255,255,255,0.1); color: black; }
                .opt-btn-whatsapp { background: linear-gradient(135deg, #FFD700, #C9A227); color: white; display: flex; align-items: center; justify-content: center; gap: 8px; }
                .opt-btn-whatsapp:hover { transform: translateY(-2px); box-shadow: 0 5px 20px rgba(37,211,102,0.4); }
                .opt-range { width: 100%; height: 6px; border-radius: 3px; background: rgba(255,255,255,0.1); -webkit-appearance: none; }
                .opt-range::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%; background: #667eea; cursor: pointer; }
                .opt-badge-pos { display: flex; flex-wrap: wrap; gap: 6px; }
                .opt-badge-item { padding: 6px 10px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; cursor: pointer; font-size: 11px; }
                .opt-badge-item.active { background: rgba(102,126,234,0.2); border-color: #667eea; }
                .opt-shipping { background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); border-radius: 10px; padding: 12px; text-align: center; margin-bottom: 15px; }
                .opt-shipping-value { font-size: 24px; font-weight: 700; color: #10b981; }
                .opt-upload-box { border: 2px dashed rgba(102,126,234,0.5); border-radius: 10px; padding: 25px; text-align: center; background: rgba(102,126,234,0.05); margin-bottom: 15px; }
                .opt-upload-box:hover { border-color: #667eea; background: rgba(102,126,234,0.1); }
                .opt-file-btn { display: inline-block; background: linear-gradient(135deg, #FFD700, #C9A227); color: white; padding: 10px 24px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 13px; margin-top: 10px; }
                .opt-preview { margin-top: 12px; display: none; }
                .opt-preview img { max-width: 120px; max-height: 120px; border-radius: 8px; border: 2px solid #10b981; }
                .opt-divider { display: flex; align-items: center; margin: 15px 0; color: #0f0f10; font-size: 12px; }
                .opt-divider::before, .opt-divider::after { content: ''; flex: 1; height: 1px; background: rgba(255,255,255,0.1); }
                .opt-divider span { padding: 0 10px; }
            </style>
        `;

    if (!isLicensed) {
      return styles + this.getLicenseHTML();
    }

    if (window.WEB_OPTIMIZER_MODE) {
      return styles + this.getWebHTML();
    }

    return styles + this.getMainHTML();
  },

  // Simplified web UI — upload only, no session/category setup
  getWebHTML: function () {
    return `
            <div class="opt-modal">
                <div class="opt-header">
                    <h2><span>🚀</span> Upload & Optimize</h2>
                    <button class="opt-close" id="close-modal">&times;</button>
                </div>
                <div class="opt-body">
                    <div class="opt-section" style="padding:12px;background:linear-gradient(135deg, #FFD700, #C9A227),rgba(102,126,234,0.1));border:1px solid rgba(16,185,129,0.3);">
                        <div class="opt-section-title" style="color:#10b981;">🎯 Smart Mode</div>
                        <div class="opt-row" style="margin-bottom:10px;">
                            <div>
                                <label class="opt-label">Target Shipping</label>
                                <select id="target-shipping" class="opt-select" style="font-size:13px;font-weight:600;">
                                    <option value="30">≤ ₹30</option>
                                    <option value="40">≤ ₹40</option>
                                    <option value="50">≤ ₹50</option>
                                    <option value="60">≤ ₹60</option>
                                    <option value="70">≤ ₹70</option>
                                    <option value="80" selected>≤ ₹80</option>
                                    <option value="90">≤ ₹90</option>
                                    <option value="100">≤ ₹100</option>
                                </select>
                            </div>
                            <div>
                                <label class="opt-label">Max Variants</label>
                                <select id="max-attempts" class="opt-select">
                                    <option value="10">10</option>
                                    <option value="20">20</option>
                                    <option value="50" selected>50</option>
                                    <option value="100">100</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div class="opt-section" style="padding:10px;">
                        <div class="opt-section-title">✏️ Text on image (optional)</div>
                        <input type="text" id="custom-text" class="opt-input" placeholder="e.g. FREE SHIPPING" style="font-size:12px;">
                    </div>

                    <div class="opt-upload-box" id="upload-area">
                        <div style="font-size:40px;margin-bottom:8px;">📸</div>
                        <div style="font-size:15px;font-weight:600;margin-bottom:5px;">Tap to upload product image</div>
                        <div style="font-size:12px;color:#9ca3af;margin-bottom:10px;">JPG, PNG, WebP</div>
                        <label class="opt-file-btn" for="image-input">Choose Image</label>
                        <input type="file" id="image-input" accept="image/*" style="display:none;">
                        <input type="hidden" id="category-select" value="18044">
                        <div class="opt-preview" id="preview-box">
                            <img id="preview-img" alt="Preview">
                            <div style="color:#10b981;font-size:11px;margin-top:5px;">Ready</div>
                        </div>
                    </div>

                    <div id="processing-area" style="display:none;"></div>
                    <div id="results-area" style="display:none;"></div>
                </div>
            </div>
        `;
  },

  // License activation HTML with WhatsApp button and pricing plans
  getLicenseHTML: function () {
    return `
            <div class="opt-modal">
                <div class="opt-header">
                    <h2><span>🔐</span> License Required</h2>
                    <button class="opt-close" id="close-modal">&times;</button>
                </div>
                <div class="opt-body">
                    <div style="text-align:center;padding:10px 0;">
                        <div style="font-size:40px;margin-bottom:8px;">🚀</div>
                        <h3 style="margin:0 0 5px 0;color:black;">Meesho Shipping Cost AI Optimizer</h3>
                        <p style="color:#9ca3af;font-size:12px;margin-bottom:10px;">Reduce shipping costs by up to 40%</p>
                    </div>
                    
                    <!-- Pricing Plans -->
                    <div class="opt-section" style="padding:12px;">
                        <div class="opt-section-title" style="text-align:center;margin-bottom:12px;">💎 Click Plan to Buy</div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                            <!-- Monthly -->
                            <button class="plan-buy-btn" data-plan="monthly" data-price="599" data-duration="1 Month" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:10px;text-align:center;cursor:pointer;transition:all 0.2s;color:black;">
                                <div style="font-size:11px;color:#9ca3af;">Monthly</div>
                                <div style="font-size:20px;font-weight:700;color:#667eea;">₹599</div>
                                <div style="font-size:9px;color:#0f0f10;">30 days</div>
                            </button>
                            <!-- 3 Months -->
                            <button class="plan-buy-btn" data-plan="quarterly" data-price="1399" data-duration="3 Months" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:10px;text-align:center;cursor:pointer;transition:all 0.2s;color:black;">
                                <div style="font-size:11px;color:#9ca3af;">3 Months</div>
                                <div style="font-size:20px;font-weight:700;color:#667eea;">₹1399</div>
                                <div style="font-size:9px;color:#10b981;">Save ₹1000</div>
                            </button>
                            <!-- 6 Months -->
                            <button class="plan-buy-btn" data-plan="halfyearly" data-price="2299" data-duration="6 Months" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:10px;text-align:center;cursor:pointer;transition:all 0.2s;color:black;">
                                <div style="font-size:11px;color:#9ca3af;">6 Months</div>
                                <div style="font-size:20px;font-weight:700;color:#667eea;">₹2299</div>
                                <div style="font-size:9px;color:#10b981;">Save ₹3000</div>
                            </button>
                            <!-- Yearly - Best Value -->
                            <button class="plan-buy-btn" data-plan="yearly" data-price="3099" data-duration="1 Year" style="background:linear-gradient(135deg, #FFD700, #C9A227),rgba(118,75,162,0.15));border:2px solid #667eea;border-radius:8px;padding:10px;text-align:center;position:relative;cursor:pointer;transition:all 0.2s;color:black;">
                                <div style="position:absolute;top:-8px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg, #FFD700, #C9A227);color:white;padding:2px 8px;border-radius:10px;font-size:8px;font-weight:700;">BEST VALUE</div>
                                <div style="font-size:11px;color:#a78bfa;margin-top:4px;">Yearly</div>
                                <div style="font-size:20px;font-weight:700;color:#10b981;">₹3099</div>
                                <div style="font-size:9px;color:#10b981;">Save ₹8000</div>
                            </button>
                        </div>
                        <div style="margin-top:10px;padding:8px;background:rgba(167,139,250,0.1);border-radius:6px;border:1px solid rgba(167,139,250,0.2);">
                            <div style="font-size:10px;color:#a78bfa;font-weight:600;margin-bottom:4px;">✨ Yearly Plan Exclusive:</div>
                            <div style="font-size:9px;color:#9ca3af;line-height:1.4;">Beta Updates • Upcoming Features • Premium Badges • Priority Support • Advanced Analytics</div>
                        </div>
                    </div>
                    
                    <div class="opt-section" style="padding:12px;">
                        <label class="opt-label">Already have a License Key?</label>
                        <input type="text" id="license-key-input" class="opt-input" placeholder="Enter your license key" style="margin-bottom:10px;font-size:13px;">
                        <button id="activate-license-btn" class="opt-btn opt-btn-success" style="width:100%;padding:10px;">Activate License</button>
                    </div>
                    
                    <p style="margin-top:8px;font-size:10px;color:#0f0f10;text-align:center;">
                        Click on any plan to buy via WhatsApp • Instant activation
                    </p>
                </div>
            </div>
        `;
  },

  // Main optimizer HTML (after license) - Enhanced UI, Smart Mode Auto-Selected
  getMainHTML: function () {
    return `
            <div class="opt-modal">
                <div class="opt-header">
                    <h2><span>🚀</span> Meesho Shipping Cost AI Optimizer</h2>
                    <button class="opt-close" id="close-modal">&times;</button>
                </div>
                <div class="opt-body">
                    <div class="opt-shipping">
                        <div style="font-size:11px;color:#9ca3af;">Current Shipping</div>
                        <div class="opt-shipping-value" id="current-shipping">Detecting...</div>
                    </div>

                    <!-- Category Selection -->
                    <div class="opt-section" style="padding:12px;">
                        <div class="opt-section-title" style="display:flex;justify-content:space-between;align-items:center;">
                            <span>📁 Category (Required)</span>
                            <button id="refresh-categories" style="background:rgba(102,126,234,0.2);border:none;color:#a78bfa;padding:4px 8px;border-radius:4px;cursor:pointer;font-size:10px;display:none;" title="Refresh">🔄 Refresh</button>
                        </div>
                        <div style="position:relative;">
                            <input type="text" id="category-search" class="opt-input" placeholder="🔍 Search category..." style="font-size:12px;padding-right:30px;">
                            <span id="category-clear" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);cursor:pointer;color:#9ca3af;display:none;">✕</span>
                        </div>
                        <div id="category-dropdown" style="display:none;max-height:180px;overflow-y:auto;background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.15);border-radius:0 0 8px 8px;margin-top:-1px;"></div>
                        <div id="category-error" style="display:none;margin-top:8px;padding:8px;background:rgba(239,68,68,0.15);border-radius:6px;border:1px solid rgba(239,68,68,0.3);">
                            <span style="font-size:11px;color:#ef4444;">⚠️ Categories not loaded. Click 🔄 Refresh or reload page.</span>
                        </div>
                        <div id="selected-category" style="margin-top:8px;padding:8px;background:rgba(102,126,234,0.15);border-radius:6px;display:none;">
                            <span style="font-size:11px;color:#a78bfa;">✓ </span>
                            <span id="selected-category-name" style="font-size:12px;color:black;font-weight:600;"></span>
                        </div>
                        <input type="hidden" id="category-select" value="">
                    </div>

                    <!-- Smart Mode Settings - Auto Selected -->
                    <div class="opt-section" style="padding:12px;background:linear-gradient(135deg, #FFD700, #C9A227),rgba(102,126,234,0.1));border:1px solid rgba(16,185,129,0.3);">
                        <div class="opt-section-title" style="color:#10b981;">🎯 Smart Mode</div>
                        <div class="opt-row" style="margin-bottom:10px;">
                            <div>
                                <label class="opt-label">Target Shipping</label>
                                <select id="target-shipping" class="opt-select" style="font-size:13px;font-weight:600;">
                                    <option value="30" style="color:black">≤ ₹30</option>
                                    <option value="40" style="color:black">≤ ₹40</option>
                                    <option value="50" style="color:black">≤ ₹50</option>
                                    <option value="60" style="color:black">≤ ₹60</option>
                                    <option value="70" style="color:black">≤ ₹70</option>
                                    <option value="80" selected style="color:black">≤ ₹80</option>
                                    <option value="90" style="color:black">≤ ₹90</option>
                                    <option value="100" style="color:black">≤ ₹100</option>
                                </select>
                            </div>
                            <div>
                                <label class="opt-label">Max Tries</label>
                                <select id="max-attempts" class="opt-select">
                                    <option value="50" style="color:black">50</option>
                                    <option value="100" selected style="color:black">100</option>
                                    <option value="200" style="color:black">200</option>
                                </select>
                            </div>
                        </div>
                        <div style="font-size:10px;color:#9ca3af;padding:6px;background:rgba(0,0,0,0.2);border-radius:4px;">
                            ⚡ Fast API mode • ±₹5-10 variation possible
                        </div>
                    </div>

                    <!-- Custom Text (Optional) -->
                    <div class="opt-section" style="padding:10px;">
                        <div class="opt-section-title">✏️ Text (Optional)</div>
                        <input type="text" id="custom-text" class="opt-input" placeholder="e.g. FREE SHIPPING, 50% OFF" style="font-size:12px;">
                    </div>

                    <div class="opt-upload-box" id="upload-area">
                        <div style="font-size:40px;margin-bottom:8px;">📸</div>
                        <div style="font-size:15px;font-weight:600;margin-bottom:5px;">Upload Product Image</div>
                        <div style="font-size:12px;color:#9ca3af;margin-bottom:10px;">JPG, PNG, WebP</div>
                        <label class="opt-file-btn" for="image-input">Choose File</label>
                        <input type="file" id="image-input" accept="image/*" style="display:none;">
                        <div class="opt-preview" id="preview-box">
                            <img id="preview-img" alt="Preview">
                            <div style="color:#10b981;font-size:11px;margin-top:5px;">Ready</div>
                        </div>
                    </div>

                    <div id="processing-area" style="display:none;"></div>
                    <div id="results-area" style="display:none;"></div>
                </div>
            </div>
        `;
  },

  // Processing HTML
  getProcessingHTML: function (current, total, imgUrl) {
    const pct = Math.round((current / total) * 100);
    const remaining = total - current;
    const estSeconds = remaining * 5;
    let estText = "";
    if (estSeconds > 0) {
      if (estSeconds < 60) {
        estText = `~${estSeconds}s remaining`;
      } else {
        estText = `~${Math.ceil(estSeconds / 60)}m remaining`;
      }
    }

    return `
            <div style="text-align:center;padding:20px;">
                ${
                  imgUrl
                    ? '<img src="' +
                      imgUrl +
                      '" style="width:60px;height:60px;object-fit:cover;border-radius:8px;border:2px solid #667eea;margin-bottom:15px;">'
                    : ""
                }
                <div style="width:50px;height:50px;border:4px solid rgba(255,255,255,0.1);border-top:4px solid #667eea;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 15px;"></div>
                <h3 style="margin:0 0 8px 0;color:black;font-size:16px;">Processing Images</h3>
                <p style="color:#9ca3af;font-size:12px;margin-bottom:8px;">Testing variation ${current} of ${total}</p>
                <p style="color:#667eea;font-size:11px;margin-bottom:15px;">${estText}</p>
                <div style="background:rgba(255,255,255,0.1);border-radius:8px;height:10px;margin-bottom:8px;overflow:hidden;">
                    <div style="width:${pct}%;background:linear-gradient(135deg, #FFD700, #C9A227);height:100%;border-radius:8px;transition:width 0.3s;"></div>
                </div>
                <div style="font-size:11px;color:#a78bfa;margin-bottom:15px;">${pct}% Complete</div>
                <button id="stop-btn" class="opt-btn opt-btn-danger" style="padding:8px 20px;font-size:12px;">Stop & Show Results</button>
            </div>
            <style>@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}</style>
        `;
  },

  // Results HTML - Only accurate results
  getResultsHTML: function (results) {
    if (results.length === 0) {
      return `
                <div style="text-align:center;padding:30px;">
                    <div style="font-size:50px;margin-bottom:15px;">😔</div>
                    <h3 style="color:#ef4444;margin:0 0 10px 0;">No Results Found</h3>
                    <p style="color:#9ca3af;font-size:12px;margin-bottom:15px;">Could not get accurate prices for this image.</p>
                    <p style="color:#0f0f10;font-size:11px;">Try with a different image or category.</p>
                    <button id="restart-btn" class="opt-btn opt-btn-primary" style="margin-top:15px;padding:10px 25px;">Try Again</button>
                </div>
            `;
    }

    const best = results[0];
    const totalResults = results.length;
    const isWeb = !!window.WEB_OPTIMIZER_MODE;
    const isLocal = !best.shippingCost || best.shippingCost <= 0;
    const applyLabel = isWeb ? "Save" : "Apply";

    let html = `
            <div style="background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.3);border-radius:10px;padding:15px;margin-bottom:15px;text-align:center;">
                <div style="font-size:11px;color:#9ca3af;">${
                  isLocal
                    ? "✨ Variants Generated"
                    : "🏆 Best Shipping Rate Found"
                }</div>
                <div style="font-size:28px;font-weight:700;color:#10b981;">${
                  isLocal ? totalResults + " ready" : "₹" + best.shippingCost
                }</div>
                <div style="font-size:10px;color:#10b981;margin-top:2px;">${
                  isLocal ? "Tap Save to download" : "✅ Accurate Price"
                }</div>
                <div style="font-size:10px;color:#0f0f10;margin-top:4px;">${totalResults} results found</div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:15px;max-height:280px;overflow-y:auto;">
        `;

    results.slice(0, 15).forEach((r, i) => {
      const isBest = i === 0;
      html += `
                <div style="background:${
                  isBest ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.03)"
                };border:1px solid ${
        isBest ? "#10b981" : "rgba(255,255,255,0.1)"
      };border-radius:8px;padding:8px;text-align:center;position:relative;">
                    ${
                      isBest
                        ? '<div style="position:absolute;top:-6px;left:50%;transform:translateX(-50%);background:#10b981;color:white;padding:2px 8px;border-radius:10px;font-size:9px;font-weight:700;">🏆 BEST</div>'
                        : ""
                    }
                    <img src="${
                      r.imageUrl
                    }" style="width:100%;height:55px;object-fit:contain;border-radius:4px;background:rgba(0,0,0,0.2);margin-bottom:4px;margin-top:${
        isBest ? "4px" : "0"
      };" loading="lazy">
                    <div style="font-size:14px;font-weight:700;color:${
                      isBest ? "#10b981" : "black"
                    };">${r.shippingCost > 0 ? "₹" + r.shippingCost : "Ready"}</div>
                    <div style="display:flex;gap:4px;margin-top:4px;">
                        <button class="dl-btn" data-i="${i}" style="flex:1;background:rgba(102,126,234,0.2);color:#a78bfa;border:none;padding:3px;border-radius:4px;cursor:pointer;font-size:9px;">Save</button>
                        <button class="apply-btn" data-i="${i}" style="flex:1;background:${
        isBest ? "#10b981" : "rgba(255,255,255,0.1)"
      };color:white;border:none;padding:3px;border-radius:4px;cursor:pointer;font-size:9px;">${applyLabel}</button>
                    </div>
                </div>
            `;
    });

    html += `</div>
            <div style="display:flex;gap:8px;">
                <button id="apply-best-btn" class="opt-btn opt-btn-success" style="flex:1;padding:10px;">${
                  isLocal
                    ? "Download Best Variant"
                    : "Download Best ₹" + best.shippingCost
                }</button>
                <button id="restart-btn" class="opt-btn opt-btn-primary" style="flex:1;padding:10px;">New Search</button>
            </div>
        `;
    return html;
  },
};

window.OptimizerUI = OptimizerUI;
