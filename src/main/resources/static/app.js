(function () {
  'use strict';

  const API_BASE = window.PRODUCT_API_BASE || '';
  const state = { products: [], selectedId: null, mode: 'view' };
  const $ = (selector) => document.querySelector(selector);

  const elements = {
    categoryForm: $('#category-form'), categoryInput: $('#category-input'), productList: $('#product-list'),
    listStatus: $('#list-status'), resultCount: $('#result-count'), detailEmpty: $('#detail-empty'),
    productForm: $('#product-form'), detailLoading: $('#detail-loading'), detailError: $('#detail-error'),
    formTitle: $('#form-title'), formEyebrow: $('#form-eyebrow'), productId: $('#product-id'),
    formAlert: $('#form-alert'), saveButton: $('#save-button'), cancelButton: $('#cancel-button'),
    newButton: $('#new-product-button'), emptyNewButton: $('#empty-new-button'), toast: $('#toast')
  };

  elements.categoryForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const category = elements.categoryInput.value.trim();
    if (category) loadCategory(category);
  });
  elements.newButton.addEventListener('click', showCreateForm);
  elements.emptyNewButton.addEventListener('click', showCreateForm);
  elements.cancelButton.addEventListener('click', closeDetail);
  elements.productForm.addEventListener('submit', saveProduct);
  loadCategories();

  async function loadCategories() {
    try {
      const categories = await request('/products/categories');
      elements.categoryInput.innerHTML = '<option value="">Choose a category</option>' + categories.map((category) => '<option value="' + escapeHtml(category) + '">' + escapeHtml(category) + '</option>').join('');
      if (categories.length === 1) elements.categoryInput.value = categories[0];
    } catch (_) {
      // Category suggestions are helpful, but should not prevent product creation.
    }
  }

  async function request(path, options) {
    const response = await fetch(API_BASE + path, {
      headers: { 'Content-Type': 'application/json', ...(options && options.headers) }, ...options
    });
    if (!response.ok) {
      let payload = {};
      try { payload = await response.json(); } catch (_) { /* no response body */ }
      const error = new Error(payload.detail || (response.status === 404 ? 'Product not found.' : 'The request could not be completed.'));
      error.status = response.status; error.fields = payload.errors || {};
      throw error;
    }
    return response.status === 204 ? null : response.json();
  }

  async function loadCategory(category) {
    setListLoading();
    try {
      state.products = await request('/products?category=' + encodeURIComponent(category));
      renderProductList(category);
    } catch (error) {
      state.products = [];
      elements.resultCount.textContent = '0';
      elements.productList.innerHTML = '';
      elements.listStatus.innerHTML = '<div class="empty-state compact"><span class="empty-icon">!</span><strong>Could not load products</strong><span>' + escapeHtml(error.message) + '</span></div>';
    }
  }

  function setListLoading() {
    elements.productList.innerHTML = '';
    elements.listStatus.innerHTML = '<div class="empty-state compact"><div class="detail-loading"><span></span><span></span><span></span></div><strong>Loading catalog</strong></div>';
  }

  function renderProductList(category) {
    elements.resultCount.textContent = state.products.length;
    if (!state.products.length) {
      elements.productList.innerHTML = '';
      elements.listStatus.innerHTML = '<div class="empty-state compact"><span class="empty-icon">⌕</span><strong>No products in ' + escapeHtml(category) + '</strong><span>Try another category.</span></div>';
      return;
    }
    elements.listStatus.innerHTML = '';
    elements.productList.innerHTML = state.products.map((product) => '<button class="product-item" data-id="' + escapeHtml(product.id) + '" type="button"><strong>' + escapeHtml(product.name) + '</strong><span class="product-meta"><span>' + escapeHtml(product.category) + '</span><span class="product-price">$' + formatPrice(product.price) + '</span></span></button>').join('');
    elements.productList.querySelectorAll('.product-item').forEach((item) => item.addEventListener('click', () => loadProduct(item.dataset.id)));
  }

  async function loadProduct(id) {
    showLoading();
    try { showProduct(await request('/products/' + encodeURIComponent(id))); }
    catch (error) { showDetailError(error.status === 404 ? 'That product could not be found.' : error.message); }
  }

  function showProduct(product) {
    state.selectedId = product.id; state.mode = 'edit';
    elements.detailEmpty.classList.add('hidden'); elements.detailLoading.classList.add('hidden'); elements.detailError.classList.add('hidden');
    elements.productForm.classList.remove('hidden'); elements.formTitle.textContent = product.name; elements.formEyebrow.textContent = 'Product details';
    elements.productId.textContent = product.id; elements.productId.classList.remove('hidden'); elements.saveButton.textContent = 'Save changes';
    fillForm(product); clearErrors();
    elements.productList.querySelectorAll('.product-item').forEach((item) => item.classList.toggle('selected', item.dataset.id === product.id));
  }

  function showCreateForm() {
    state.selectedId = null; state.mode = 'create'; elements.detailEmpty.classList.add('hidden'); elements.detailError.classList.add('hidden'); elements.detailLoading.classList.add('hidden');
    elements.productForm.classList.remove('hidden'); elements.formTitle.textContent = 'Create product'; elements.formEyebrow.textContent = 'New product'; elements.productId.classList.add('hidden'); elements.saveButton.textContent = 'Save product';
    fillForm({ name: '', category: elements.categoryInput.value.trim(), price: '', description: '' }); clearErrors(); elements.productForm.elements.name.focus();
  }

  function closeDetail() { elements.productForm.classList.add('hidden'); elements.detailError.classList.add('hidden'); elements.detailEmpty.classList.remove('hidden'); state.selectedId = null; }

  function showLoading() { elements.detailEmpty.classList.add('hidden'); elements.productForm.classList.add('hidden'); elements.detailError.classList.add('hidden'); elements.detailLoading.classList.remove('hidden'); }
  function showDetailError(message) { elements.detailLoading.classList.add('hidden'); elements.productForm.classList.add('hidden'); elements.detailError.textContent = message; elements.detailError.classList.remove('hidden'); }
  function fillForm(product) { Object.keys(product).forEach((key) => { if (elements.productForm.elements[key]) elements.productForm.elements[key].value = product[key] ?? ''; }); }
  function clearErrors() { elements.formAlert.classList.add('hidden'); elements.formAlert.textContent = ''; elements.productForm.querySelectorAll('.field-error').forEach((item) => item.textContent = ''); }

  async function saveProduct(event) {
    event.preventDefault(); clearErrors();
    const wasCreating = state.mode === 'create';
    const form = new FormData(elements.productForm); const payload = Object.fromEntries(form.entries()); payload.name = payload.name.trim(); payload.category = payload.category.trim(); payload.price = payload.price === '' ? null : Number(payload.price); payload.description = payload.description.trim() || null;
    const localErrors = {}; if (!payload.name) localErrors.name = 'Name is required.'; if (!payload.category) localErrors.category = 'Category is required.'; if (payload.price === null || Number.isNaN(payload.price)) localErrors.price = 'Enter a valid price.'; else if (payload.price < 0) localErrors.price = 'Price cannot be negative.';
    if (Object.keys(localErrors).length) return showValidationErrors(localErrors);
    elements.saveButton.disabled = true; elements.saveButton.textContent = 'Saving…';
    try {
      const product = state.mode === 'create' ? await request('/products', { method: 'POST', body: JSON.stringify(payload) }) : await request('/products/' + encodeURIComponent(state.selectedId), { method: 'PUT', body: JSON.stringify(payload) });
      showProduct(product); toast(wasCreating ? 'Product created.' : 'Product updated.');
      elements.categoryInput.value = product.category; await loadCategory(product.category);
      await loadProduct(product.id);
    } catch (error) { if (error.fields && Object.keys(error.fields).length) showValidationErrors(error.fields); else showFormAlert(error.message); }
    finally { elements.saveButton.disabled = false; elements.saveButton.textContent = state.mode === 'create' ? 'Save product' : 'Save changes'; }
  }

  function showValidationErrors(errors) { Object.entries(errors).forEach(([field, message]) => { const target = elements.productForm.querySelector('[data-error="' + field + '"]'); if (target) target.textContent = message; }); elements.formAlert.textContent = 'Check the highlighted fields.'; elements.formAlert.classList.remove('hidden'); }
  function showFormAlert(message) { elements.formAlert.textContent = message; elements.formAlert.classList.remove('hidden'); }
  function toast(message) { elements.toast.textContent = message; elements.toast.classList.add('visible'); setTimeout(() => elements.toast.classList.remove('visible'), 2800); }
  function formatPrice(price) { return Number(price).toFixed(2); }
  function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character])); }
})();
