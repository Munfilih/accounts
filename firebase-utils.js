import { db } from './firebase-config.js';
import { collection, addDoc } from 'firebase/firestore';

// Create default categories for new users
export async function createDefaultCategories(userId) {
    const defaultCategories = [
        { name: 'Food', color: '#28a745' },
        { name: 'Transport', color: '#007bff' },
        { name: 'Entertainment', color: '#ffc107' },
        { name: 'Salary', color: '#17a2b8' },
        { name: 'Bills', color: '#dc3545' }
    ];
    
    try {
        for (const category of defaultCategories) {
            await addDoc(collection(db, 'categories'), {
                ...category,
                userId: userId
            });
        }
    } catch (error) {
        console.error('Error creating default categories:', error);
    }
}