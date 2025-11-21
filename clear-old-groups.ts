import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const clearOldGroups = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      console.error('❌ MONGO_URI not found in environment variables');
      process.exit(1);
    }

    console.log('🔄 Connecting to database...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to database\n');

    // Get the collection directly
    const db = mongoose.connection.db;
    if (!db) {
      console.error('❌ Database connection failed');
      process.exit(1);
    }

    const groupOrdersCollection = db.collection('grouporders');

    // Count existing groups
    const count = await groupOrdersCollection.countDocuments();
    console.log(`📊 Found ${count} group(s) in database`);

    if (count === 0) {
      console.log('✅ No groups to delete');
      await mongoose.connection.close();
      return;
    }

    // List groups before deletion
    const groups = await groupOrdersCollection.find({}).project({ groupId: 1, phase: 1 }).toArray();
    console.log('\n📋 Groups to be deleted:');
    groups.forEach((g: any) => {
      console.log(`   - ${g.groupId || 'N/A'} (phase: ${g.phase || 'N/A'})`);
    });

    // Delete all groups
    console.log('\n🗑️  Deleting all groups...');
    const result = await groupOrdersCollection.deleteMany({});
    console.log(`✅ Deleted ${result.deletedCount} group(s)`);

    await mongoose.connection.close();
    console.log('✅ Database connection closed');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

clearOldGroups();
