// Common Transaction Form Handler
class TransactionForm {
    constructor() {
        this.currentTransactionType = '';
        this.currentAccountId = '';
        this.accounts = [];
        this.accountTypes = [];
        this.currentUser = null;
        this.onSaveCallback = null;
        this.editingTransactionId = null;
        this.allTransactions = [];
    }

    init(user, onSaveCallback) {
        this.currentUser = user;
        this.onSaveCallback = onSaveCallback;
        this.setupEventListeners();
        this.setDefaultDate();
        this.loadAllTransactions();
    }

    async loadAllTransactions() {
        try {
            const querySnapshot = await db.collection('transactions')
                .where('userId', '==', this.currentUser.uid)
                .get();
            
            this.allTransactions = [];
            querySnapshot.forEach((doc) => {
                this.allTransactions.push({ id: doc.id, ...doc.data() });
            });
        } catch (error) {
            console.error('Error loading transactions:', error);
        }
    }

    setupEventListeners() {
        document.getElementById('transactionForm').addEventListener('submit', (e) => this.handleTransaction(e));
        document.getElementById('enableEMI').addEventListener('change', () => this.toggleEMIOptions());
        document.getElementById('emiNumbers').addEventListener('input', () => this.calculateEMIFromInputs());
        document.getElementById('emiAmount').addEventListener('input', () => this.calculateEMIFromInputs());
        document.getElementById('quickAccountForm').addEventListener('submit', (e) => this.handleQuickAccount(e));
        document.getElementById('transactionAccount').addEventListener('change', () => this.handleAccountChange());
    }

    setDefaultDate() {
        document.getElementById('transactionDate').value = new Date().toISOString().split('T')[0];
    }

    async showReceiptModal(accountId = null) {
        this.currentTransactionType = 'receive';
        this.currentAccountId = accountId;
        
        document.getElementById('transactionModalTitle').textContent = 'Add Receipt';
        await this.loadTransactionTypes('receipt');
        document.getElementById('emiSection').style.display = 'block';
        await this.loadAccountsForModal();
        
        if (accountId) {
            document.getElementById('transactionAccount').value = accountId;
        }
        
        new bootstrap.Modal(document.getElementById('transactionModal')).show();
    }

    async showPaymentModal(accountId = null) {
        this.currentTransactionType = 'pay';
        this.currentAccountId = accountId;
        
        document.getElementById('transactionModalTitle').textContent = 'Add Payment';
        await this.loadTransactionTypes('payment');
        document.getElementById('emiSection').style.display = 'none';
        document.getElementById('emiOptions').style.display = 'none';
        await this.loadAccountsForModal();
        
        if (accountId) {
            document.getElementById('transactionAccount').value = accountId;
        }
        
        new bootstrap.Modal(document.getElementById('transactionModal')).show();
    }

    async loadTransactionTypes(category) {
        const typeSelect = document.getElementById('transactionType');
        typeSelect.innerHTML = '<option value="">Select Type</option>';
        
        try {
            const querySnapshot = await db.collection('transaction_types')
                .where('userId', '==', this.currentUser.uid)
                .where('category', '==', category)
                .get();
            
            if (querySnapshot.empty) {
                const defaultTypes = category === 'receipt' 
                    ? [{ name: 'Savings' }, { name: 'Loan' }]
                    : [{ name: 'Credit' }, { name: 'Repayment' }];
                
                defaultTypes.forEach(type => {
                    const option = document.createElement('option');
                    option.value = type.name.toLowerCase();
                    option.textContent = type.name;
                    typeSelect.appendChild(option);
                });
            } else {
                querySnapshot.forEach(doc => {
                    const type = doc.data();
                    const option = document.createElement('option');
                    option.value = type.name.toLowerCase();
                    option.textContent = type.name;
                    typeSelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error loading transaction types:', error);
        }
    }

    async loadAccountsForModal() {
        try {
            const [accountsSnapshot, typesSnapshot] = await Promise.all([
                db.collection('accounts').where('userId', '==', this.currentUser.uid).get(),
                db.collection('account_types').where('userId', '==', this.currentUser.uid).get()
            ]);
            
            this.accounts = [];
            accountsSnapshot.forEach(doc => this.accounts.push({ id: doc.id, ...doc.data() }));
            
            this.accountTypes = [];
            typesSnapshot.forEach(doc => this.accountTypes.push({ id: doc.id, ...doc.data() }));
            
            this.updateAccountSelect();
            this.updateQuickAccountTypes();
        } catch (error) {
            console.error('Error loading accounts:', error);
        }
    }

    updateAccountSelect() {
        const accountSelect = document.getElementById('transactionAccount');
        accountSelect.innerHTML = '<option value="">Select Account</option>';
        
        this.accounts.forEach(account => {
            const option = document.createElement('option');
            option.value = account.id;
            option.textContent = account.name;
            accountSelect.appendChild(option);
        });
    }

    async handleAccountChange() {
        const accountId = document.getElementById('transactionAccount').value;
        
        if (this.currentTransactionType === 'pay' && accountId) {
            await this.checkForEMIPayments(accountId);
        } else {
            this.hideEMIPayments();
        }
    }

    async checkForEMIPayments(accountId) {
        try {
            // Get EMI transactions for this account
            const emiSnapshot = await db.collection('transactions')
                .where('userId', '==', this.currentUser.uid)
                .where('accountId', '==', accountId)
                .where('enableEMI', '==', true)
                .get();
            
            if (emiSnapshot.empty) {
                this.hideEMIPayments();
                return;
            }

            // Get paid EMI dates
            const paidSnapshot = await db.collection('transactions')
                .where('userId', '==', this.currentUser.uid)
                .where('accountId', '==', accountId)
                .where('type', '==', 'pay')
                .get();
            
            const paidDates = new Set();
            paidSnapshot.forEach(doc => {
                paidDates.add(doc.data().date);
            });

            // Generate unpaid EMI list
            let unpaidEMIs = [];
            emiSnapshot.forEach(doc => {
                const emiData = doc.data();
                const startDate = new Date(emiData.date);
                const emiNumbers = parseInt(emiData.emiNumbers) || 0;
                const emiAmount = parseFloat(emiData.emiAmount) || 0;
                const emiType = emiData.emiType || 'month';

                for (let i = 1; i <= emiNumbers; i++) {
                    const emiDate = new Date(startDate);
                    
                    if (emiType === 'month') {
                        emiDate.setMonth(startDate.getMonth() + i);
                    } else if (emiType === 'week') {
                        emiDate.setDate(startDate.getDate() + (i * 7));
                    } else if (emiType === 'day') {
                        emiDate.setDate(startDate.getDate() + i);
                    } else if (emiType === 'year') {
                        emiDate.setFullYear(startDate.getFullYear() + i);
                    }
                    
                    const dateStr = emiDate.toISOString().split('T')[0];
                    
                    if (!paidDates.has(dateStr)) {
                        unpaidEMIs.push({
                            date: dateStr,
                            amount: emiAmount,
                            installment: i,
                            displayDate: emiDate.toLocaleDateString()
                        });
                    }
                }
            });

            if (unpaidEMIs.length > 0) {
                this.showEMIPayments(unpaidEMIs);
            } else {
                this.hideEMIPayments();
            }
        } catch (error) {
            console.error('Error checking EMI payments:', error);
            this.hideEMIPayments();
        }
    }

    showEMIPayments(unpaidEMIs) {
        const emiSection = document.getElementById('emiPaymentSection');
        const emiList = document.getElementById('emiPaymentList');
        
        emiSection.style.display = 'block';
        
        const html = unpaidEMIs.map(emi => `
            <div class="form-check mb-2">
                <input class="form-check-input emi-payment-checkbox" type="checkbox" 
                       value="${emi.date}" data-amount="${emi.amount}" 
                       id="emi_${emi.date}" onchange="TransactionFormInstance.calculateEMITotal()">
                <label class="form-check-label" for="emi_${emi.date}">
                    <div class="d-flex justify-content-between align-items-center">
                        <span>EMI ${emi.installment} - ${emi.displayDate}</span>
                        <span class="fw-bold text-danger">₹${emi.amount.toFixed(2)}</span>
                    </div>
                </label>
            </div>
        `).join('');
        
        emiList.innerHTML = html;
    }

    hideEMIPayments() {
        document.getElementById('emiPaymentSection').style.display = 'none';
        document.getElementById('emiPaymentList').innerHTML = '';
    }

    calculateEMITotal() {
        const checkboxes = document.querySelectorAll('.emi-payment-checkbox:checked');
        let total = 0;
        
        checkboxes.forEach(checkbox => {
            total += parseFloat(checkbox.dataset.amount) || 0;
        });
        
        if (total > 0) {
            document.getElementById('transactionAmount').value = total;
            document.getElementById('transactionAmount').readOnly = true;
        } else {
            document.getElementById('transactionAmount').value = '';
            document.getElementById('transactionAmount').readOnly = false;
        }
    }

    updateQuickAccountTypes() {
        const typeSelect = document.getElementById('quickAccountType');
        typeSelect.innerHTML = '<option value="">Select Type</option>';
        
        this.accountTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type.id;
            option.textContent = type.name;
            typeSelect.appendChild(option);
        });
    }

    toggleEMIOptions() {
        const emiOptions = document.getElementById('emiOptions');
        const enableEMI = document.getElementById('enableEMI');
        
        if (enableEMI.checked) {
            emiOptions.style.display = 'block';
        } else {
            emiOptions.style.display = 'none';
            document.getElementById('totalEMIAmount').textContent = '₹0.00';
        }
    }

    calculateEMIFromInputs() {
        const emiNumbers = parseFloat(document.getElementById('emiNumbers').value) || 0;
        const emiAmount = parseFloat(document.getElementById('emiAmount').value) || 0;
        
        const total = emiNumbers * emiAmount;
        document.getElementById('totalEMIAmount').textContent = `₹${total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        document.getElementById('transactionAmount').value = total;
    }

    async handleTransaction(e) {
        e.preventDefault();
        
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Saving...';
        submitBtn.disabled = true;
        
        try {
            const type = document.getElementById('transactionType').value;
            const accountId = document.getElementById('transactionAccount').value;
            const amount = parseFloat(document.getElementById('transactionAmount').value);
            const description = document.getElementById('transactionDescription')?.value || '';
            const enableEMI = document.getElementById('enableEMI')?.checked || false;
            
            if (!type || !accountId || !amount) {
                this.showAlert('Please fill in all required fields.', 'warning');
                return;
            }
            
            const transactionDate = document.getElementById('transactionDate').value;
            if (!transactionDate) {
                this.showAlert('Please select a date.', 'warning');
                return;
            }
            
            // Check if EMI payments are selected
            const selectedEMIs = document.querySelectorAll('.emi-payment-checkbox:checked');
            
            if (this.editingTransactionId) {
                // Handle transaction update
                const transactionData = {
                    accountId: accountId,
                    type: this.currentTransactionType,
                    subType: type,
                    amount: amount,
                    description: description,
                    date: transactionDate,
                    enableEMI: enableEMI,
                    emiNumbers: enableEMI ? parseInt(document.getElementById('emiNumbers')?.value) || 0 : null,
                    emiAmount: enableEMI ? parseFloat(document.getElementById('emiAmount')?.value) || 0 : null,
                    emiType: enableEMI ? document.getElementById('emiType')?.value || 'month' : null,
                    updatedAt: new Date().toISOString()
                };
                
                await db.collection('transactions').doc(this.editingTransactionId).update(transactionData);
                const action = transactionData.type === 'receive' ? 'Receipt' : 'Payment';
                this.showAlert(`${action} updated successfully!`, 'success');
            } else if (selectedEMIs.length > 0) {
                // Handle multiple EMI payments
                const batch = db.batch();
                
                selectedEMIs.forEach(checkbox => {
                    const emiDate = checkbox.value;
                    const emiAmount = parseFloat(checkbox.dataset.amount);
                    
                    const transactionData = {
                        userId: this.currentUser.uid,
                        accountId: accountId,
                        type: this.currentTransactionType,
                        subType: type,
                        amount: emiAmount,
                        description: description || `EMI Payment - ${emiDate}`,
                        date: emiDate,
                        isEMIPayment: true,
                        createdAt: new Date().toISOString()
                    };
                    
                    const docRef = db.collection('transactions').doc();
                    batch.set(docRef, transactionData);
                });
                
                await batch.commit();
                this.showAlert(`${selectedEMIs.length} EMI payments of ₹${amount.toFixed(2)} saved successfully!`, 'success');
            } else {
                // Handle regular transaction
                const transactionData = {
                    userId: this.currentUser.uid,
                    accountId: accountId,
                    type: this.currentTransactionType,
                    subType: type,
                    amount: amount,
                    description: description,
                    date: transactionDate,
                    enableEMI: enableEMI,
                    emiNumbers: enableEMI ? parseInt(document.getElementById('emiNumbers')?.value) || 0 : null,
                    emiAmount: enableEMI ? parseFloat(document.getElementById('emiAmount')?.value) || 0 : null,
                    emiType: enableEMI ? document.getElementById('emiType')?.value || 'month' : null,
                    createdAt: new Date().toISOString()
                };
                
                await db.collection('transactions').add(transactionData);
                const account = this.accounts.find(a => a.id === accountId);
                const action = transactionData.type === 'receive' ? 'Receipt' : 'Payment';
                
                this.showAlert(`${action} of ₹${amount.toFixed(2)} saved successfully!`, 'success');
            }
            
            bootstrap.Modal.getInstance(document.getElementById('transactionModal')).hide();
            this.resetForm();
            
            if (this.onSaveCallback) {
                this.onSaveCallback();
            }
        } catch (error) {
            console.error('Error saving transaction:', error);
            this.showAlert('Error saving transaction: ' + error.message, 'danger');
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }

    async handleQuickAccount(e) {
        e.preventDefault();
        
        const accountData = {
            name: document.getElementById('quickAccountName').value,
            type: document.getElementById('quickAccountType').value,
            userId: this.currentUser.uid,
            createdAt: new Date().toISOString()
        };
        
        try {
            const docRef = await db.collection('accounts').add(accountData);
            this.accounts.push({ id: docRef.id, ...accountData });
            
            this.updateAccountSelect();
            document.getElementById('transactionAccount').value = docRef.id;
            
            bootstrap.Modal.getInstance(document.getElementById('quickAccountModal')).hide();
            document.getElementById('quickAccountForm').reset();
            
            this.showAlert('Account added successfully!', 'success');
        } catch (error) {
            console.error('Error adding account:', error);
            this.showAlert('Error adding account.', 'danger');
        }
    }

    showQuickAccountModal() {
        new bootstrap.Modal(document.getElementById('quickAccountModal')).show();
    }

    resetForm() {
        document.getElementById('transactionForm').reset();
        this.setDefaultDate();
        document.getElementById('emiOptions').style.display = 'none';
        document.getElementById('totalEMIAmount').textContent = '₹0.00';
        this.hideEMIPayments();
        document.getElementById('transactionAmount').readOnly = false;
        this.currentTransactionType = '';
        this.currentAccountId = '';
        this.editingTransactionId = null;
    }

    async editTransaction(transactionId) {
        const transaction = this.allTransactions.find(t => t.id === transactionId);
        if (!transaction) {
            console.error('Transaction not found:', transactionId);
            return;
        }

        this.editingTransactionId = transactionId;
        this.currentTransactionType = transaction.type;
        this.currentAccountId = transaction.accountId;

        // Set modal title
        const modalTitle = transaction.type === 'receive' ? 'Edit Receipt' : 'Edit Payment';
        document.getElementById('transactionModalTitle').textContent = modalTitle;

        // Load transaction types and accounts
        const category = transaction.type === 'receive' ? 'receipt' : 'payment';
        await this.loadTransactionTypes(category);
        await this.loadAccountsForModal();

        // Populate form fields
        document.getElementById('transactionType').value = transaction.subType || '';
        document.getElementById('transactionAccount').value = transaction.accountId;
        document.getElementById('transactionAmount').value = transaction.amount;
        document.getElementById('transactionDescription').value = transaction.description || '';
        document.getElementById('transactionDate').value = transaction.date;

        // Handle EMI fields if applicable
        if (transaction.enableEMI) {
            document.getElementById('enableEMI').checked = true;
            document.getElementById('emiNumbers').value = transaction.emiNumbers || '';
            document.getElementById('emiAmount').value = transaction.emiAmount || '';
            document.getElementById('emiType').value = transaction.emiType || 'month';
            this.toggleEMIOptions();
        }

        // Show modal
        new bootstrap.Modal(document.getElementById('transactionModal')).show();
    }

    showAlert(message, type) {
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
}

// Global instance
const TransactionFormInstance = new TransactionForm();