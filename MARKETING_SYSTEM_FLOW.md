# Farmchops Marketing System - How It Works

---

## 🎯 ADMIN SIDE

### Creating a Marketer
1. Admin logs into admin portal
2. Goes to "Marketers" page → Click "Add Marketer"
3. Fills form: Name, Email, Phone, Commission Rate (e.g., 10%)
4. Clicks "Create"
5. System generates unique code (e.g., "MARK001")
6. **Email automatically sent to marketer** with:
   - Their marketing code
   - How to use it
   - Commission details
7. Marketer now shows in admin's list

### Creating a Coupon
1. Admin goes to "Coupons" page → Click "Add Coupon"
2. Fills form:
   - Code: "SAVE10"
   - Type: Percentage (10%)
   - Max discount: ₦2,000
   - Min order: ₦5,000
   - Valid dates
   - Max uses: 100 (optional)
   - Max per user: 1 (optional)
3. Clicks "Create"
4. Coupon is now active and ready to use

### Promoting the Coupon (Admin's Job)
**⚠️ IMPORTANT:** Creating a coupon does NOT automatically notify customers!

**Admin must promote it via:**
1. **Send Email Campaign**
   - Use email marketing tool
   - "Use code SAVE10 for 10% off!"
   - Include link to website

2. **Post on Social Media**
   - Instagram: Post + story with code
   - Facebook: Announcement post
   - Twitter: Promotional tweet

3. **Update Website**
   - Add banner: "Active Promo: SAVE10"
   - Homepage pop-up
   - Add to product pages

4. **WhatsApp Broadcast**
   - Message all contacts
   - Include code and expiry date

5. **SMS Campaign** (optional)
   - Send bulk SMS with code

**Example promotion message:**
```
🎉 Limited Time Offer!
Use code SAVE10 for 10% off your order
(Max ₦2,000 discount)
Valid until Jan 31st
Shop now: farmchops.com
```

### Managing Commissions
1. Admin views marketer reports
2. Sees unpaid commission (e.g., ₦75,000)
3. Pays marketer via bank transfer
4. Records payment in system
5. Marketer's unpaid commission resets to ₦0

---

## 👤 MARKETER SIDE

### Getting Started
1. Receives welcome email with code "MARK001"
2. Shares code with potential customers via:
   - WhatsApp messages
   - Social media posts
   - Phone calls
   - Flyers/cards

### Example Message to Customers:
"Sign up at farmchops.com using code **MARK001** and get 10% off your first order!"

### Earning Commission
1. Customer uses marketer's code during signup
2. Customer places their **first order**
3. Marketer earns 10% commission on that order
4. No commission on customer's future orders

### Getting Paid
1. Marketer contacts admin monthly
2. Admin sends performance report via email/WhatsApp
3. Admin pays commission
4. Marketer receives payment confirmation

**Note:** Marketers cannot log in to view their own stats. They rely on admin for reports.

---

## 🛒 CUSTOMER SIDE

### Signing Up with Referral Code

**Option 1: With Marketer Code**
1. Customer visits farmchops.com
2. Clicks "Sign Up"
3. Fills registration form
4. Enters referral code: "MARK001" (optional)
5. Completes signup
6. Customer is now linked to marketer

**Option 2: Without Marketer Code**
1. Customer signs up normally
2. No referral code entered
3. Still eligible for first-time discount

### Shopping & Checkout

**Step 1: Add items to cart**
- Browse products
- Add to cart
- Cart shows subtotal (e.g., ₦50,000)

**Step 2: Go to checkout**
- Enter delivery address
- System calculates delivery fee

**Step 3: Apply Coupon (Optional)**

**How customers discover available coupons:**

**Before they even get to checkout:**
1. **Email Notifications**
   - "New Year Sale! Use code NEWYEAR2025 for 20% off"
   - Sent to all registered users

2. **Social Media**
   - Instagram/Facebook posts: "Limited time! SAVE10 for 10% off"
   - Stories with swipe-up links
   - Twitter announcements

3. **WhatsApp Marketing**
   - Broadcast messages: "Exclusive for you: FREEDEL"
   - Status updates with codes

4. **Website Banners**
   - Top banner: "🎉 Use code WEEKEND for ₦500 off!"
   - Homepage pop-up when they visit
   - Sticky footer with active promotion

5. **SMS Campaigns**
   - Text message: "Flash sale! FLASH20 expires in 24hrs"

6. **App Push Notifications**
   - "Don't forget! SAVE10 still active"

7. **During Browsing**
   - Product pages show: "Use SAVE10 at checkout"
   - Cart page reminder: "Have a coupon? Apply at checkout"

**At checkout page:**
- Coupon input field is ALWAYS visible
- May show hint: "Have a promo code? Enter it here"
- Some sites show: "Active promotions: SAVE10, FREEDEL"

**Where customer gets coupon codes:**
- Email promotions from Farmchops
- Social media posts (Instagram, Twitter, Facebook)
- WhatsApp broadcast messages
- Website banners/pop-ups
- SMS campaigns
- Influencer promotions
- Word of mouth (friends sharing codes)

**How to use coupon:**

1. Customer sees promotion: "Use code **SAVE10** for 10% off!"
2. At checkout page, finds "Have a coupon?" section
3. Types "SAVE10" in the coupon input field
4. Clicks "Apply" button
5. **System validates coupon:**
   - ✅ Is the code valid? (active, not expired)
   - ✅ Does order meet minimum amount? (e.g., ₦5,000)
   - ✅ Has customer already used it? (if per-user limit exists)
   - ✅ Has coupon reached max uses? (if total limit exists)

6. **If valid:**
   - ✅ Success message: "Coupon applied! You save ₦2,000"
   - ✅ Discount appears in order summary
   - ✅ Total updates automatically

7. **If invalid:**
   - ❌ Error message shows:
     - "Invalid coupon code"
     - "Order below minimum ₦5,000"
     - "You've already used this coupon"
     - "Coupon has expired"
     - "Coupon usage limit reached"

**Step 4: View discount (automatic or coupon)**
- **First-time buyer?** → Automatic 10% off (max ₦2,000)
- **Has coupon code?** → Enter & apply code (e.g., "SAVE10")
- System picks **BEST discount** (no stacking)

**Checkout shows:**
```
Subtotal:              ₦50,000
Discount (SAVE10):     -₦5,000
Subtotal after:        ₦45,000
Delivery:              ₦2,000
Tax (7.5%):           ₦3,375
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total:                ₦50,375
```

**Step 5: Complete order**
- Choose payment method (Paystack/Wallet/Pay Later)
- Confirm order
- Order created!
- Coupon usage recorded

### What Happens Behind the Scenes:

**If customer was referred by marketer:**
1. Order linked to marketer
2. Marketer earns 10% commission on THIS order only
3. Marketer's stats updated:
   - Total orders: +1
   - Revenue: +₦50,000
   - Commission: +₦5,000

**If customer used first-time discount:**
1. Flag set: "hasUsedFirstTimeDiscount = true"
2. Customer won't get this discount again

**If customer used coupon:**
1. Coupon usage count +1
2. Customer added to "used by" list
3. Coupon may become inactive if max uses reached

---

## 🎫 COUPON TYPES EXPLAINED

### 1. Percentage Discount Coupon
**Example:** SAVE10
- **Discount:** 10% off
- **Max discount:** ₦2,000 (prevents unlimited savings)
- **Min order:** ₦5,000

**How it works:**
- Customer has ₦50,000 cart → Gets ₦2,000 off (capped at max)
- Customer has ₦10,000 cart → Gets ₦1,000 off (10% = ₦1,000)
- Customer has ₦3,000 cart → Can't use (below ₦5,000 minimum)

### 2. Fixed Amount Coupon
**Example:** FLAT500
- **Discount:** ₦500 off
- **Min order:** ₦2,000

**How it works:**
- Any order ≥ ₦2,000 gets ₦500 off
- Simple and straightforward
- Same discount regardless of cart size

### 3. Free Delivery Coupon
**Example:** FREEDEL
- **Discount:** Delivery fee waived
- **Min order:** ₦10,000

**How it works:**
- Customer adds items to cart totaling ₦15,000
- At checkout, delivery fee calculated as ₦2,000
- Customer enters "FREEDEL" coupon code
- System validates:
  - ✅ Is coupon active and not expired?
  - ✅ Does order meet minimum (₦10,000)? ✅ Yes
  - ✅ Has customer already used it? (if per-user limit exists)
- **Delivery fee becomes ₦0** on checkout summary
- Customer only pays for products + tax
- Checkout shows:
  ```
  Subtotal:              ₦15,000
  Discount (FREEDEL):    ₦0 (free delivery applied)
  Subtotal after:        ₦15,000
  Delivery:              ₦0 (was ₦2,000)
  Tax (7.5%):           ₦1,125
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Total:                ₦16,125
  ```

**Note:** Free delivery competes with other discounts (10% off vs free delivery). System automatically picks whichever saves more money.

---

## 💡 KEY RULES

### Discounts
- ✅ First-time discount: **10% off, max ₦2,000, min order ₦5,000**
- ✅ Only **ONE discount per order** (system picks best one)
- ✅ Tax calculated **AFTER discount**
- ✅ Must be logged in to get discounts

### Marketer Commission
- ✅ **First order only** per referred customer
- ✅ Calculated on **subtotal BEFORE discount**
- ✅ Paid **monthly** by admin
- ✅ Rate: **10%** (or custom per marketer)

### Coupons
- ✅ Can have usage limits (total & per user)
- ✅ Can have validity dates
- ✅ Types: Percentage, Fixed amount, Free delivery
- ✅ Anyone can use (not linked to specific marketer)

---

## 📊 EXAMPLE SCENARIOS

### Scenario 1: New Customer with Marketer Code

1. Jane hears about Farmchops from Marketer John (code: MARK001)
2. Jane signs up, enters "MARK001"
3. Jane is linked to John
4. Jane adds ₦50,000 worth of items to cart
5. At checkout, Jane sees: **10% off = ₦2,000 discount** (first-time buyer)
6. Jane pays ₦48,000 + delivery + tax
7. **John earns ₦5,000 commission** (10% of ₦50,000 subtotal)
8. Next time Jane orders, **no discount, no commission for John**

### Scenario 2: Customer with Coupon Code

1. Mike is a returning customer (already used first-time discount)
2. Mike has coupon "SAVE10" (10% off, max ₦2,000)
3. Mike adds ₦30,000 to cart
4. Enters "SAVE10" at checkout
5. Gets ₦2,000 discount
6. Pays ₦28,000 + delivery + tax
7. Coupon usage count increases

### Scenario 3: New Customer, No Referral, No Coupon

1. Sarah signs up normally (no referral code)
2. Adds ₦50,000 to cart
3. At checkout, gets automatic **10% off = ₦2,000** (first-time buyer)
4. Pays ₦48,000 + delivery + tax
5. **No marketer earns commission**
6. Next order: no discount

---

## 🔄 MONTHLY COMMISSION CYCLE

**Week 1-4: Marketers work**
- Marketers share codes
- Customers sign up & order
- Commissions accumulate

**End of Month: Admin reviews**
- Admin logs in
- Views all marketers' unpaid commissions
- Example:
  - John: ₦75,000 unpaid
  - Mary: ₦50,000 unpaid
  - Peter: ₦25,000 unpaid

**Admin pays**
- Transfers money to marketers
- Records each payment in system
- System resets unpaid amounts to ₦0

**Marketers receive**
- Bank transfer notification
- Email confirmation from admin

---

## ✅ WHAT'S AUTOMATED

- ✅ Marketing code generation
- ✅ Welcome email to marketers
- ✅ Discount calculation at checkout
- ✅ Commission tracking
- ✅ Coupon usage tracking
- ✅ First-time discount eligibility
- ✅ Order totals calculation

## 📝 WHAT'S MANUAL

- ❌ Marketer performance reports (admin views & shares)
- ❌ Commission payments (admin transfers & records)
- ❌ Marketer onboarding (admin creates account)
- ❌ Coupon creation (admin creates)

---

---

## ❓ COMMON COUPON QUESTIONS

**Q: Can I use multiple coupons on one order?**
A: No. System picks the BEST discount automatically. No stacking allowed.

**Q: Can I use a coupon with first-time discount?**
A: Yes, but system will pick whichever saves you more money.

**Q: What if I have a coupon but I'm a first-time buyer?**
A: System compares both and gives you the better deal:
- First-time: 10% off (max ₦2,000)
- Coupon SAVE20: 20% off (max ₦5,000)
- **You get:** SAVE20 (better discount)

**Q: Can I use the same coupon multiple times?**
A: Depends on the coupon settings:
- Some coupons: One-time use only
- Some coupons: Multiple uses allowed
- Check error message if coupon doesn't work

**Q: Do coupons expire?**
A: Yes, most coupons have:
- Start date (when they become active)
- End date (when they expire)
- Admin sets these dates when creating coupon

**Q: Why isn't my coupon working?**
A: Check:
- ✅ Is it spelled correctly? (case doesn't matter)
- ✅ Is your cart above minimum amount?
- ✅ Have you already used it? (if one-time only)
- ✅ Has it expired?
- ✅ Are you logged in?

**Q: Where do I enter the coupon code?**
A: At checkout page, look for:
- "Have a coupon?" section
- "Promo code" or "Discount code" input field
- Usually above or below order summary

**Q: Can I share my coupon code with friends?**
A: Yes! Coupons work for anyone (unlike referral codes which are marketer-specific).

**Q: What's the difference between referral code and coupon code?**
A:
- **Referral code (e.g., MARK001):**
  - Used during SIGNUP
  - Links you to a marketer
  - Marketer earns commission

- **Coupon code (e.g., SAVE10):**
  - Used at CHECKOUT
  - Gives you discount
  - No one earns commission
  - Anyone can use it

---

**That's it! Simple and straightforward.** 🎉
