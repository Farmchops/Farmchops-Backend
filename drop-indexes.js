// Script to drop duplicate indexes
const mongoose = require('mongoose');
require('dotenv').config();

async function dropIndexes() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;

    // Drop indexes on Order collection
    const orderCollection = db.collection('orders');
    await orderCollection.dropIndex('paymentReference_1').catch(() => console.log('Index paymentReference_1 not found'));
    console.log('✓ Dropped paymentReference_1 index');

    // Drop indexes on WalletTransaction collection
    const walletCollection = db.collection('wallettransactions');
    await walletCollection.dropIndex('reference_1').catch(() => console.log('Index reference_1 not found'));
    console.log('✓ Dropped reference_1 index');

    console.log('\n✅ All duplicate indexes dropped successfully!');
    console.log('Restart your server to rebuild indexes correctly.');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

dropIndexes();
