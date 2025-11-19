import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { GroupOrder } from './src/models/GroupOrder';
import { Product } from './src/models/Product';

// Load environment variables
dotenv.config();

async function debugGroups() {
  try {
    console.log('🔍 Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('✅ Connected to database\n');

    // Check total groups
    const totalGroups = await GroupOrder.countDocuments();
    console.log(`📊 Total groups in database: ${totalGroups}`);

    // Check active groups
    const activeGroups = await GroupOrder.find({ status: 'active' });
    console.log(`🟢 Active groups: ${activeGroups.length}`);

    // Check confirmed groups
    const confirmedGroups = await GroupOrder.countDocuments({ status: 'confirmed' });
    console.log(`✅ Confirmed groups: ${confirmedGroups}`);

    // Check cancelled groups
    const cancelledGroups = await GroupOrder.countDocuments({ status: 'cancelled' });
    console.log(`❌ Cancelled groups: ${cancelledGroups}\n`);

    if (activeGroups.length > 0) {
      console.log('📋 Active Groups Details:\n');
      activeGroups.forEach((group, index) => {
        console.log(`${index + 1}. Group ID: ${group.groupId}`);
        console.log(`   Product: ${group.product.name}`);
        console.log(`   Slots: ${group.filledSlots}/${group.totalSlots}`);
        console.log(`   Status: ${group.status}`);
        console.log(`   Created: ${group.createdAt}`);
        console.log('');
      });
    } else {
      console.log('⚠️  No active groups found!\n');

      // Check if any groups exist at all
      const allGroups = await GroupOrder.find().limit(5);
      if (allGroups.length > 0) {
        console.log('📋 Showing last 5 groups (any status):\n');
        allGroups.forEach((group, index) => {
          console.log(`${index + 1}. Group ID: ${group.groupId}`);
          console.log(`   Product: ${group.product.name}`);
          console.log(`   Slots: ${group.filledSlots}/${group.totalSlots}`);
          console.log(`   Status: ${group.status}`);
          console.log(`   Created: ${group.createdAt}`);
          console.log('');
        });
      } else {
        console.log('⚠️  No groups exist in the database at all!');
        console.log('\n💡 You need to:');
        console.log('   1. Enable group buying for a product');
        console.log('   2. Create a group for that product\n');

        // Check if any products have group buying enabled
        const productsWithGroupBuying = await Product.find({ groupBuyingEnabled: true });
        console.log(`📦 Products with group buying enabled: ${productsWithGroupBuying.length}`);

        if (productsWithGroupBuying.length > 0) {
          console.log('\n📋 Products with group buying:\n');
          productsWithGroupBuying.forEach((product, index) => {
            console.log(`${index + 1}. ${product.name}`);
            console.log(`   ID: ${product._id}`);
            console.log(`   Config: ${JSON.stringify(product.groupConfig, null, 2)}`);
            console.log('');
          });
        } else {
          console.log('⚠️  No products have group buying enabled!');
        }
      }
    }

    await mongoose.disconnect();
    console.log('\n✅ Database connection closed');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

debugGroups();
