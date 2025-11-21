import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const checkActiveGroups = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      console.error('❌ MONGO_URI not found in environment variables');
      process.exit(1);
    }

    console.log('🔄 Connecting to database...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to database\n');

    // Import models after connection
    const { GroupOrder } = await import('./src/models/GroupOrder');

    // Count all groups
    const totalGroups = await GroupOrder.countDocuments();
    console.log(`📊 Total groups in database: ${totalGroups}\n`);

    if (totalGroups === 0) {
      console.log('⚠️  No groups found in database');
      await mongoose.connection.close();
      return;
    }

    // Get all groups with their phases
    const allGroups = await GroupOrder.find({}).select('groupId phase createdAt');
    console.log('📋 All groups:');
    allGroups.forEach(g => {
      console.log(`   - ${g.groupId}: phase="${g.phase}", created=${g.createdAt.toISOString()}`);
    });
    console.log('');

    // Check active groups (filling or checkout_window)
    const activeGroups = await GroupOrder.find({
      phase: { $in: ['filling', 'checkout_window'] }
    });
    console.log(`✅ Active groups (filling or checkout_window): ${activeGroups.length}`);
    activeGroups.forEach(g => {
      console.log(`   - ${g.groupId}: phase="${g.phase}"`);
    });

    // Check each phase count
    console.log('\n📈 Groups by phase:');
    const phases = ['filling', 'checkout_window', 'confirmed', 'expired', 'cancelled'];
    for (const phase of phases) {
      const count = await GroupOrder.countDocuments({ phase });
      console.log(`   - ${phase}: ${count}`);
    }

    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

checkActiveGroups();
