let currentUser = null;
let allTransactions = [];
let filteredTransactions = [];
let accounts = [];
let currentPage = 1;
const itemsPerPage = 20;

document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            
            // Wait for transaction form to load, then initialize
            const waitForForm = setInterval(() => {
                if (document.getElementById('transactionModal')) {
                    clearInterval(waitForForm);
                    
                    // Initialize common transaction form
                    TransactionFormInstance.init(user, async () => {
                        await loadTransactions();
                    });
                }
            }, 100);
            
            await loadAccounts();
            await loadTransactions();
        } else {
            window.location.href = 'login.html';
        }
    });
});

function setupEventListeners() {
    // Mobile menu toggle
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('overlay');
    
    if (menuToggle && sidebar && overlay) {
        menuToggle.addEventListener('click', (e) => {
            e.preventDefault();
            sidebar.classList.toggle('show');
            overlay.classList.toggle('show');
        });
        
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('show');
            overlay.classList.remove('show');
        });
    }
    
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', () => auth.signOut());
    
    // Search and filter inputs
    document.getElementById('searchInput').addEventListener('input', debounce(applyFilters, 300));
    document.getElementById('typeFilter').addEventListener('change', applyFilters);
    document.getElementById('accountFilter').addEventListener('change', applyFilters);
    document.getElementById('fromDate').addEventListener('change', applyFilters);
    document.getElementById('toDate').addEventListener('change', applyFilters);
    document.getElementById('sortBy').addEventListener('change', applyFilters);
    document.getElementById('sortOrder').addEventListener('change', applyFilters);
    document.getElementById('emiFilter').addEventListener('change', applyFilters);
}

async function loadAccounts() {
    try {
        const querySnapshot = await db.collection('accounts')
            .where('userId', '==', currentUser.uid)
            .get();
        
        accounts = [];
        querySnapshot.forEach((doc) => {
            accounts.push({ id: doc.id, ...doc.data() });
        });
        
        // Populate account filter
        const accountFilter = document.getElementById('accountFilter');
        accountFilter.innerHTML = '<option value="">All Accounts</option>';
        accounts.forEach(account => {
            const option = document.createElement('option');
            option.value = account.id;
            option.textContent = account.name;
            accountFilter.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading accounts:', error);
    }
}

async function loadTransactions() {
    try {
        const querySnapshot = await db.collection('transactions')
            .where('userId', '==', currentUser.uid)
            .get();
        
        allTransactions = [];
        querySnapshot.forEach((doc) => {
            allTransactions.push({ id: doc.id, ...doc.data() });
        });
        
        applyFilters();
    } catch (error) {
        console.error('Error loading transactions:', error);
    }
}

function applyFilters() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const typeFilter = document.getElementById('typeFilter').value;
    const accountFilter = document.getElementById('accountFilter').value;
    const fromDate = document.getElementById('fromDate').value;
    const toDate = document.getElementById('toDate').value;
    const sortBy = document.getElementById('sortBy').value;
    const sortOrder = document.getElementById('sortOrder').value;
    const emiOnly = document.getElementById('emiFilter').checked;
    
    filteredTransactions = allTransactions.filter(transaction => {
        // Search filter
        if (searchTerm) {
            const account = accounts.find(a => a.id === transaction.accountId);
            const searchText = `${transaction.description || ''} ${account?.name || ''}`.toLowerCase();
            if (!searchText.includes(searchTerm)) return false;
        }
        
        // Type filter
        if (typeFilter && transaction.type !== typeFilter) return false;
        
        // Account filter
        if (accountFilter && transaction.accountId !== accountFilter) return false;
        
        // Date filters
        if (fromDate && transaction.date < fromDate) return false;
        if (toDate && transaction.date > toDate) return false;
        
        // EMI filter
        if (emiOnly && !transaction.enableEMI) return false;
        
        return true;
    });
    
    // Sort transactions
    filteredTransactions.sort((a, b) => {
        let aValue, bValue;
        
        switch (sortBy) {
            case 'amount':
                aValue = parseFloat(a.amount);
                bValue = parseFloat(b.amount);
                break;
            case 'account':
                const aAccount = accounts.find(acc => acc.id === a.accountId);
                const bAccount = accounts.find(acc => acc.id === b.accountId);
                aValue = aAccount?.name || '';
                bValue = bAccount?.name || '';
                break;
            default: // date
                aValue = new Date(a.date);
                bValue = new Date(b.date);
        }
        
        if (sortOrder === 'asc') {
            return aValue > bValue ? 1 : -1;
        } else {
            return aValue < bValue ? 1 : -1;
        }
    });
    
    updateSummary();
    renderTransactions();
}

function updateSummary() {
    const totalCount = filteredTransactions.length;
    const totalReceipts = filteredTransactions
        .filter(t => t.type === 'receive')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const totalPayments = filteredTransactions
        .filter(t => t.type === 'pay')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const netAmount = totalReceipts - totalPayments;
    
    document.getElementById('totalCount').textContent = totalCount;
    document.getElementById('totalReceipts').textContent = `₹${totalReceipts.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById('totalPayments').textContent = `₹${totalPayments.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById('netAmount').textContent = `₹${netAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function renderTransactions() {
    const container = document.getElementById('transactionsList');
    
    if (filteredTransactions.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted py-4">
                <i class="fas fa-exchange-alt fa-2x mb-2"></i>
                <p>No transactions found</p>
            </div>
        `;
        return;
    }
    
    // Pagination
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageTransactions = filteredTransactions.slice(startIndex, endIndex);
    
    const html = pageTransactions.map(transaction => {
        const account = accounts.find(a => a.id === transaction.accountId);
        const typeClass = transaction.type === 'receive' ? 'text-success' : 'text-danger';
        const typeIcon = transaction.type === 'receive' ? 'fa-arrow-down' : 'fa-arrow-up';
        const typeText = transaction.type === 'receive' ? 'Receipt' : 'Payment';
        
        return `
            <div class="transaction-item" onclick="showTransactionDetails('${transaction.id}')">
                <div class="row align-items-center">
                    <div class="col-md-1 text-center">
                        <i class="fas ${typeIcon} ${typeClass} fa-lg"></i>
                    </div>
                    <div class="col-md-6">
                        <div class="fw-bold">${transaction.description || typeText}</div>
                        <small class="text-muted">
                            ${account?.name || 'Unknown Account'} • ${transaction.date}
                            ${transaction.enableEMI ? ` • EMI: ${transaction.emiNumbers} ${transaction.emiType}s` : ''}
                        </small>
                    </div>
                    <div class="col-md-3 text-end">
                        <div class="fw-bold ${typeClass}">
                            ${transaction.type === 'receive' ? '+' : '-'}₹${parseFloat(transaction.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        ${transaction.enableEMI ? `<small class="text-muted">₹${parseFloat(transaction.emiAmount).toFixed(2)} each</small>` : ''}
                    </div>
                    <div class="col-md-2 text-end">
                        <span class="badge bg-${transaction.type === 'receive' ? 'success' : 'danger'}">${typeText}</span>
                        ${transaction.enableEMI ? '<br><small class="badge bg-info mt-1">EMI</small>' : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = html;
    renderPagination();
}

function renderPagination() {
    const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
    const paginationContainer = document.getElementById('pagination');
    
    if (totalPages <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }
    
    let paginationHtml = '<nav><ul class="pagination">';
    
    // Previous button
    paginationHtml += `
        <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="changePage(${currentPage - 1})">Previous</a>
        </li>
    `;
    
    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
            paginationHtml += `
                <li class="page-item ${i === currentPage ? 'active' : ''}">
                    <a class="page-link" href="#" onclick="changePage(${i})">${i}</a>
                </li>
            `;
        } else if (i === currentPage - 3 || i === currentPage + 3) {
            paginationHtml += '<li class="page-item disabled"><span class="page-link">...</span></li>';
        }
    }
    
    // Next button
    paginationHtml += `
        <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="changePage(${currentPage + 1})">Next</a>
        </li>
    `;
    
    paginationHtml += '</ul></nav>';
    paginationContainer.innerHTML = paginationHtml;
}

function changePage(page) {
    const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
    if (page >= 1 && page <= totalPages) {
        currentPage = page;
        renderTransactions();
    }
}

function showTransactionDetails(transactionId) {
    const transaction = allTransactions.find(t => t.id === transactionId);
    if (!transaction) return;
    
    const account = accounts.find(a => a.id === transaction.accountId);
    const typeText = transaction.type === 'receive' ? 'Receipt' : 'Payment';
    const typeClass = transaction.type === 'receive' ? 'text-success' : 'text-danger';
    
    // Update modal content
    document.getElementById('transactionDetailsTitle').textContent = `${typeText} Transaction`;
    document.getElementById('detailTransactionAmount').innerHTML = `<span class="${typeClass}">${transaction.type === 'receive' ? '+' : '-'}₹${parseFloat(transaction.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>`;
    document.getElementById('detailTransactionDate').textContent = new Date(transaction.date).toLocaleDateString();
    document.getElementById('detailTransactionType').innerHTML = `<span class="badge bg-${transaction.type === 'receive' ? 'success' : 'danger'}">${typeText}</span>`;
    document.getElementById('detailTransactionAccount').textContent = account ? account.name : 'Unknown Account';
    document.getElementById('detailTransactionDescription').textContent = transaction.description || 'No description';
    
    // EMI details
    const emiSection = document.getElementById('detailEMISection');
    if (transaction.enableEMI) {
        emiSection.style.display = 'block';
        document.getElementById('detailEMINumbers').textContent = transaction.emiNumbers;
        document.getElementById('detailEMIAmount').textContent = `₹${parseFloat(transaction.emiAmount).toFixed(2)}`;
        document.getElementById('detailEMIType').textContent = transaction.emiType;
    } else {
        emiSection.style.display = 'none';
    }
    
    // Attachment details
    const attachmentSection = document.getElementById('detailAttachmentSection');
    if (transaction.attachment) {
        attachmentSection.style.display = 'block';
        document.getElementById('viewAttachmentBtn').onclick = () => viewAttachment(transactionId);
    } else {
        attachmentSection.style.display = 'none';
    }
    
    // Set up action buttons
    document.getElementById('editTransactionBtn').onclick = () => editTransaction(transactionId);
    document.getElementById('deleteTransactionBtn').onclick = () => deleteTransaction(transactionId);
    
    new bootstrap.Modal(document.getElementById('transactionDetailsModal')).show();
}

function viewAttachment(transactionId) {
    const transaction = allTransactions.find(t => t.id === transactionId);
    if (!transaction || !transaction.attachment) return;
    
    const dataUrl = `data:${transaction.attachment.type};base64,${transaction.attachment.data}`;
    const newWindow = window.open();
    
    if (transaction.attachment.type.startsWith('image/')) {
        newWindow.document.write(`<img src="${dataUrl}" style="max-width: 100%; height: auto;" alt="${transaction.attachment.name}">`);
    } else {
        newWindow.location.href = dataUrl;
    }
}

function editTransaction(transactionId) {
    // Redirect to accounts page with edit mode
    window.location.href = `accounts.html?edit=${transactionId}`;
}

async function deleteTransaction(transactionId) {
    const transaction = allTransactions.find(t => t.id === transactionId);
    if (!transaction) return;
    
    const account = accounts.find(a => a.id === transaction.accountId);
    const accountName = account?.name || 'Unknown Account';
    
    if (!confirm(`Delete ${transaction.type} transaction of ₹${transaction.amount} for ${accountName}?`)) {
        return;
    }
    
    try {
        await db.collection('transactions').doc(transactionId).delete();
        showAlert('Transaction deleted successfully!', 'success');
        bootstrap.Modal.getInstance(document.getElementById('transactionDetailsModal')).hide();
        await loadTransactions();
    } catch (error) {
        console.error('Error deleting transaction:', error);
        showAlert('Error deleting transaction.', 'danger');
    }
}

function clearFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('typeFilter').value = '';
    document.getElementById('accountFilter').value = '';
    document.getElementById('fromDate').value = '';
    document.getElementById('toDate').value = '';
    document.getElementById('sortBy').value = 'date';
    document.getElementById('sortOrder').value = 'desc';
    document.getElementById('emiFilter').checked = false;
    currentPage = 1;
    applyFilters();
}

async function showReceiptModal() {
    await TransactionFormInstance.showReceiptModal();
}

async function showPaymentModal() {
    await TransactionFormInstance.showPaymentModal();
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function showAlert(message, type) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    alertDiv.style.cssText = 'top: 20px; right: 20px; z-index: 1050; min-width: 300px;';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(alertDiv);
    
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.parentNode.removeChild(alertDiv);
        }
    }, 5000);
}