    const restaurants = window.RESTAURANTS || [{id: "rong-hangzhou-dasha", name: "荣小馆杭州大厦店", subtitle: "26-06-26 菜单整理版", status: "ready"}];
    const defaultRestaurantId = restaurants[0].id;
    const menu = window.MENU_DATA.map((row, index) => {
      const hasRestaurant = row.length >= 7;
      const offset = hasRestaurant ? 1 : 0;
      const restaurantId = hasRestaurant ? row[0] : defaultRestaurantId;
      return {
        restaurantId,
        cat: row[offset],
        name: row[offset + 1],
        spec: row[offset + 2],
        price: row[offset + 3],
        unit: row[offset + 4],
        market: !!row[offset + 5],
        id: hasRestaurant ? `${restaurantId}:${index}` : String(index)
      };
    });
    const cookingTerms = [
      "蒜蓉粉丝蒸", "黄贡椒蒸", "刀板香蒸", "炒大蒜苗", "烧年糕",
      "雪菜蒸", "豆豉蒸", "黄酒蒸", "烧粉皮", "烧豆腐",
      "广式蒸", "笼仔蒸", "黄贡椒炒", "姜葱炒", "豆腐汤",
      "清蒸", "家烧", "辣烧", "椒麻", "沸腾", "葱油",
      "红烧", "清炖", "红焖", "碎蒸", "剁椒蒸", "白灼",
      "盐水", "蒜蓉", "干煎", "焖面", "炒咸菜", "蛋白蒸"
    ];
    const state = {
      activeCat: "全部",
      activeRestaurant: defaultRestaurantId,
      query: "",
      selectedOnly: false,
      methodDraft: {},
      cart: {}
    };
    const els = {
      categoryStrip: document.getElementById("categoryStrip"),
      menuList: document.getElementById("menuList"),
      searchInput: document.getElementById("searchInput"),
      showSelectedBtn: document.getElementById("showSelectedBtn"),
      restaurantStrip: document.getElementById("restaurantStrip"),
      restaurantTitle: document.getElementById("restaurantTitle"),
      restaurantSub: document.getElementById("restaurantSub"),
      orderList: document.getElementById("orderList"),
      orderMeta: document.getElementById("orderMeta"),
      fixedTotal: document.getElementById("fixedTotal"),
      pendingCount: document.getElementById("pendingCount"),
      grandTotal: document.getElementById("grandTotal"),
      topCount: document.getElementById("topCount"),
      topTotal: document.getElementById("topTotal"),
      copyBtn: document.getElementById("copyBtn"),
      printBtn: document.getElementById("printBtn"),
      clearBtn: document.getElementById("clearBtn"),
      saveBtn: document.getElementById("saveBtn"),
      mobileTotal: document.getElementById("mobileTotal"),
      mobileMeta: document.getElementById("mobileMeta"),
      mobileOrderBtn: document.getElementById("mobileOrderBtn"),
      orderPanel: document.getElementById("orderPanel"),
      toast: document.getElementById("toast")
    };
    function money(value) {
      const rounded = Math.round((Number(value) || 0) * 100) / 100;
      const display = Number.isInteger(rounded)
        ? String(rounded)
        : rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
      return `¥${display}`;
    }
    function priceLabel(item) {
      if (item.market) return `时价/${item.unit}`;
      return `¥${item.price}/${item.unit}`;
    }
    function currentRestaurant() {
      return restaurants.find(restaurant => restaurant.id === state.activeRestaurant) || restaurants[0];
    }
    function restaurantItems() {
      return menu.filter(item => item.restaurantId === state.activeRestaurant);
    }
    function restaurantCategories() {
      const items = restaurantItems();
      return ["全部", ...Array.from(new Set(items.map(item => item.cat)))];
    }
    function restaurantStatusText(restaurant) {
      if (restaurant.status === "pending") return "菜单待导入";
      return restaurant.subtitle || "";
    }
    function cookingOptions(item) {
      if (!["甄选小海鲜", "招牌菜"].includes(item.cat)) return [];
      const text = item.spec || "";
      const found = cookingTerms
        .map(term => ({term, index: text.indexOf(term)}))
        .filter(item => item.index >= 0);
      const filtered = found.filter(item => !found.some(other =>
        other.term !== item.term &&
        other.term.includes(item.term) &&
        other.index === item.index
      ));
      const ordered = filtered
        .sort((a, b) => a.index - b.index || b.term.length - a.term.length)
        .map(item => item.term);
      return [...new Set(ordered)].filter(Boolean);
    }
    function defaultMethod(item) {
      return cookingOptions(item)[0] || "";
    }
    function currentMethod(item) {
      const entry = state.cart[item.id];
      if (entry?.qty > 0 && entry.method) return entry.method;
      return state.methodDraft[item.id] || entry?.method || defaultMethod(item);
    }
    function renderMethodSelect(item) {
      const options = cookingOptions(item);
      if (options.length <= 1) return "";
      const selected = currentMethod(item);
      const optionHtml = options
        .map(method => `<option value="${method}"${method === selected ? " selected" : ""}>${method}</option>`)
        .join("");
      return `
        <label class="method-choice">
          <span>做法</span>
          <select data-method="${item.id}" aria-label="${item.name}做法">${optionHtml}</select>
        </label>
      `;
    }
    function itemById(id) {
      return menu.find(item => item.id === String(id));
    }
    function allowsDecimalQty(item) {
      return item?.unit === "斤";
    }
    function qtyStep(item) {
      return allowsDecimalQty(item) ? 0.1 : 1;
    }
    function defaultQty(item) {
      return allowsDecimalQty(item) ? 1 : 1;
    }
    function normalizeQty(item, value) {
      const number = Number(value);
      if (!Number.isFinite(number) || number <= 0) return 0;
      if (allowsDecimalQty(item)) return Math.round(number * 100) / 100;
      return Math.max(1, Math.round(number));
    }
    function formatQty(value) {
      const rounded = Math.round((Number(value) || 0) * 100) / 100;
      return Number.isInteger(rounded)
        ? String(rounded)
        : rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
    }
    function getLinePrice(item) {
      const entry = state.cart[item.id];
      if (!entry) return null;
      if (item.market) {
        const value = Number(entry.customPrice);
        return Number.isFinite(value) && value > 0 ? value : null;
      }
      return item.price;
    }
    function totals() {
      let fixed = 0;
      let qty = 0;
      let selectedItems = 0;
      let pending = 0;
      for (const item of restaurantItems()) {
        const entry = state.cart[item.id];
        if (!entry || entry.qty <= 0) continue;
        selectedItems += 1;
        qty += Number(entry.qty) || 0;
        const linePrice = getLinePrice(item);
        if (linePrice === null) {
          pending += 1;
        } else {
          fixed += linePrice * (Number(entry.qty) || 0);
        }
      }
      return {fixed, qty, selectedItems, pending};
    }
    function setQty(id, value) {
      const item = itemById(id);
      if (!item) return;
      const current = state.cart[id] || {
        qty: 0,
        customPrice: "",
        method: state.methodDraft[id] || defaultMethod(item)
      };
      const method = currentMethod(item);
      const qty = normalizeQty(item, value);
      if (qty === 0) {
        delete state.cart[id];
      } else {
        state.cart[id] = {...current, method: method || current.method || defaultMethod(item), qty};
      }
      render();
    }
    function addItem(id, direction = 1) {
      const item = itemById(id);
      if (!item) return;
      const current = state.cart[id] || {qty: 0, customPrice: ""};
      const qty = normalizeQty(item, (Number(current.qty) || 0) + direction * qtyStep(item));
      setQty(id, qty);
    }
    function addDefaultItem(id) {
      const item = itemById(id);
      if (!item) return;
      setQty(id, defaultQty(item));
    }
    function setMarketPrice(id, value) {
      const item = itemById(id);
      const current = state.cart[id] || {qty: 0, customPrice: "", method: item ? currentMethod(item) : ""};
      state.cart[id] = {...current, customPrice: value};
      renderOrder();
      renderTotals();
    }
    function setMethod(id, value) {
      const current = state.cart[id];
      if (current && current.qty > 0) {
        state.cart[id] = {...current, method: value};
      } else {
        state.methodDraft[id] = value;
      }
      render();
    }
    function visibleItems() {
      const query = state.query.trim().toLowerCase();
      return restaurantItems().filter(item => {
        const entry = state.cart[item.id];
        if (state.selectedOnly && (!entry || entry.qty <= 0)) return false;
        if (state.activeCat !== "全部" && item.cat !== state.activeCat) return false;
        if (!query) return true;
        return [item.name, item.spec, item.cat, cookingOptions(item).join(" "), String(item.price || ""), item.unit]
          .join(" ")
          .toLowerCase()
          .includes(query);
      });
    }
    function renderRestaurants() {
      const counts = new Map();
      for (const item of menu) counts.set(item.restaurantId, (counts.get(item.restaurantId) || 0) + 1);
      els.restaurantStrip.innerHTML = restaurants.map(restaurant => {
        const active = restaurant.id === state.activeRestaurant ? " active" : "";
        const pending = restaurant.status === "pending" ? " pending" : "";
        const count = counts.get(restaurant.id) || 0;
        return `<button class="restaurant-button${active}${pending}" type="button" data-restaurant="${restaurant.id}">${restaurant.name} ${count}</button>`;
      }).join("");
      const restaurant = currentRestaurant();
      els.restaurantTitle.textContent = `${restaurant.name}点菜单`;
      els.restaurantSub.textContent = restaurantStatusText(restaurant);
      document.title = `${restaurant.name}点菜单`;
    }
    function renderCategories() {
      const categories = restaurantCategories();
      const items = restaurantItems();
      els.categoryStrip.innerHTML = categories.map(cat => {
        const active = cat === state.activeCat ? " active" : "";
        const count = cat === "全部" ? items.length : items.filter(item => item.cat === cat).length;
        return `<button class="cat-button${active}" type="button" data-cat="${cat}">${cat} ${count}</button>`;
      }).join("");
    }
    function renderMenu() {
      const items = visibleItems();
      const grouped = new Map();
      for (const item of items) {
        if (!grouped.has(item.cat)) grouped.set(item.cat, []);
        grouped.get(item.cat).push(item);
      }
      els.menuList.innerHTML = "";
      if (items.length === 0) {
        const restaurant = currentRestaurant();
        els.menuList.innerHTML = restaurant.status === "pending"
          ? `<div class="empty-note"><strong>${restaurant.name}</strong><br>二维码已读取，但点餐页需要微信/支付宝授权后才能查看菜单。当前先保留餐厅入口，菜单截图发来后可继续导入。</div>`
          : `<div class="empty">没有匹配菜品</div>`;
        return;
      }
      for (const [cat, catItems] of grouped.entries()) {
        const section = document.createElement("section");
        section.className = "section";
        section.innerHTML = `
          <div class="section-head">
            <h2>${cat}</h2>
            <span class="section-count">${catItems.length} 项</span>
          </div>
          <div class="menu-grid">
            ${catItems.map(renderDishCard).join("")}
          </div>
        `;
        els.menuList.appendChild(section);
      }
    }
    function renderDishCard(item) {
      const entry = state.cart[item.id];
      const qty = Number(entry?.qty) || 0;
      const selected = qty > 0 ? " selected" : "";
      const controls = qty > 0
        ? `<div class="qty-control${allowsDecimalQty(item) ? " weight" : ""}">
             <button type="button" data-action="dec" data-id="${item.id}">-</button>
             ${allowsDecimalQty(item)
               ? `<input type="number" min="0" step="0.1" inputmode="decimal" aria-label="${item.name}斤数" value="${formatQty(qty)}" data-qty="${item.id}">`
               : `<span>${formatQty(qty)}</span>`}
             <button type="button" data-action="inc" data-id="${item.id}">+</button>
           </div>`
        : `<button class="add-button" type="button" data-action="add" data-id="${item.id}">加入</button>`;
      const price = item.market
        ? `<div class="market-price">
             <span class="tag">时价</span>
             <input type="number" min="0" step="1" inputmode="decimal" placeholder="单价" value="${entry?.customPrice || ""}" data-market="${item.id}">
             <span>/ ${item.unit}</span>
           </div>`
        : `<div class="price">${priceLabel(item)}</div>`;
      return `
        <article class="dish-card${selected}">
          <div>
            <div class="dish-name">${item.name}</div>
            ${item.spec ? `<div class="dish-spec">${item.spec}</div>` : ""}
            ${renderMethodSelect(item)}
          </div>
          <div class="dish-meta">
            ${price}
            ${controls}
          </div>
        </article>
      `;
    }
    function renderOrder() {
      const selected = restaurantItems().filter(item => state.cart[item.id]?.qty > 0);
      if (selected.length === 0) {
        els.orderList.innerHTML = `<div class="empty">尚未选择菜品</div>`;
        return;
      }
      els.orderList.innerHTML = selected.map(item => {
        const entry = state.cart[item.id];
        const linePrice = getLinePrice(item);
        const qty = Number(entry.qty) || 0;
        const lineTotal = linePrice === null ? "待填价" : money(linePrice * qty);
        const marketInput = item.market
          ? `<label class="order-market">单价 <input type="number" min="0" step="1" inputmode="decimal" value="${entry.customPrice || ""}" data-market="${item.id}"></label>`
          : `<span class="order-market">${priceLabel(item)}</span>`;
        return `
          <article class="order-item">
            <div class="order-line">
              <div>
                <div class="order-name">${item.name}</div>
                ${item.spec ? `<div class="order-spec">${item.spec}</div>` : ""}
                ${renderMethodSelect(item)}
              </div>
              <div class="line-total">${lineTotal}</div>
            </div>
            <div class="order-actions">
              <div class="qty-control${allowsDecimalQty(item) ? " weight" : ""}">
                <button type="button" data-action="dec" data-id="${item.id}">-</button>
                ${allowsDecimalQty(item)
                  ? `<input type="number" min="0" step="0.1" inputmode="decimal" aria-label="${item.name}斤数" value="${formatQty(qty)}" data-qty="${item.id}">`
                  : `<span>${formatQty(qty)}</span>`}
                <button type="button" data-action="inc" data-id="${item.id}">+</button>
              </div>
              ${marketInput}
            </div>
          </article>
        `;
      }).join("");
    }
    function renderTotals() {
      const t = totals();
      els.fixedTotal.textContent = money(t.fixed);
      els.grandTotal.textContent = money(t.fixed);
      els.topTotal.textContent = money(t.fixed);
      els.pendingCount.textContent = `${t.pending} 项`;
      els.orderMeta.textContent = `${t.selectedItems} 项菜品`;
      els.topCount.textContent = t.selectedItems;
      els.mobileTotal.textContent = money(t.fixed);
      els.mobileMeta.textContent = t.pending > 0
        ? `已选 ${t.selectedItems} 项，${t.pending} 项时价未填`
        : `已选 ${t.selectedItems} 项`;
    }
    function render() {
      renderRestaurants();
      renderCategories();
      renderMenu();
      renderOrder();
      renderTotals();
      els.showSelectedBtn.textContent = state.selectedOnly ? "显示全部" : "只看已选";
    }
    function saveCart() {
      localStorage.setItem("rong-menu-cart", JSON.stringify(state.cart));
      toast("已保存");
    }
    function loadCart() {
      try {
        const saved = JSON.parse(localStorage.getItem("rong-menu-cart") || "{}");
        if (saved && typeof saved === "object") state.cart = saved;
      } catch (error) {
        state.cart = {};
      }
    }
    function saveRestaurant() {
      localStorage.setItem("rong-menu-restaurant", state.activeRestaurant);
    }
    function loadRestaurant() {
      const saved = localStorage.getItem("rong-menu-restaurant");
      if (restaurants.some(restaurant => restaurant.id === saved)) state.activeRestaurant = saved;
    }
    function clearCart() {
      const ids = new Set(restaurantItems().map(item => item.id));
      for (const id of ids) {
        delete state.cart[id];
        delete state.methodDraft[id];
      }
      localStorage.setItem("rong-menu-cart", JSON.stringify(state.cart));
      render();
      toast("已清空");
    }
    function orderText() {
      const restaurant = currentRestaurant();
      const selected = restaurantItems().filter(item => state.cart[item.id]?.qty > 0);
      const lines = [`${restaurant.name}点菜单`];
      let pending = 0;
      for (const item of selected) {
        const entry = state.cart[item.id];
        const linePrice = getLinePrice(item);
        if (linePrice === null) pending += 1;
        const spec = item.spec ? `（${item.spec}）` : "";
        const method = currentMethod(item);
        const methodText = method ? `【${method}】` : "";
        const qty = Number(entry.qty) || 0;
        const amount = linePrice === null ? "待填价" : money(linePrice * qty);
        lines.push(`${item.name}${methodText}${spec} x ${formatQty(qty)}${item.unit}  ${amount}`);
      }
      const t = totals();
      lines.push(`合计：${money(t.fixed)}`);
      if (pending) lines.push(`时价未填：${pending} 项`);
      return lines.join("\n");
    }
    async function copyOrder() {
      const text = orderText();
      try {
        await navigator.clipboard.writeText(text);
        toast("清单已复制");
      } catch (error) {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
        toast("清单已复制");
      }
    }
    function toast(message) {
      els.toast.textContent = message;
      els.toast.classList.add("show");
      clearTimeout(window.__toastTimer);
      window.__toastTimer = setTimeout(() => els.toast.classList.remove("show"), 1400);
    }
    document.addEventListener("click", event => {
      const restaurantButton = event.target.closest("[data-restaurant]");
      if (restaurantButton) {
        state.activeRestaurant = restaurantButton.dataset.restaurant;
        state.activeCat = "全部";
        saveRestaurant();
        render();
        return;
      }
      const catButton = event.target.closest("[data-cat]");
      if (catButton) {
        state.activeCat = catButton.dataset.cat;
        render();
        return;
      }
      const actionButton = event.target.closest("[data-action]");
      if (actionButton) {
        const action = actionButton.dataset.action;
        if (action === "add") {
          addDefaultItem(actionButton.dataset.id);
        } else {
          addItem(actionButton.dataset.id, action === "inc" ? 1 : -1);
        }
      }
    });
    document.addEventListener("input", event => {
      if (event.target === els.searchInput) {
        state.query = els.searchInput.value;
        renderMenu();
        return;
      }
      if (event.target.matches("[data-market]")) {
        setMarketPrice(event.target.dataset.market, event.target.value);
      }
    });
    document.addEventListener("change", event => {
      if (event.target.matches("[data-method]")) {
        setMethod(event.target.dataset.method, event.target.value);
        return;
      }
      if (event.target.matches("[data-qty]")) {
        setQty(event.target.dataset.qty, event.target.value);
      }
    });
    els.showSelectedBtn.addEventListener("click", () => {
      state.selectedOnly = !state.selectedOnly;
      render();
    });
    els.copyBtn.addEventListener("click", copyOrder);
    els.printBtn.addEventListener("click", () => window.print());
    els.clearBtn.addEventListener("click", clearCart);
    els.saveBtn.addEventListener("click", saveCart);
    els.mobileOrderBtn.addEventListener("click", () => {
      els.orderPanel.scrollIntoView({behavior: "smooth", block: "start"});
    });
    loadCart();
    loadRestaurant();
    render();
