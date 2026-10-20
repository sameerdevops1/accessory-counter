# Accessory Counter

A public online shop and a private admin area for a mobile-accessories business.

- **Shop** (`/`): customers browse products, fill a basket and place an order. They pay when they collect. `/track` lets them check an order with its code and mobile number.
- **Admin** (`/admin`): sign in to manage inventory, receive stock, sell at the counter, handle orders and see customers.
- **Scanning**: the camera stays open and reads each barcode as you present it. Use it to receive deliveries and to sell at the counter. USB and Bluetooth scanner guns also work, because they type into the box and press Enter.

Customers never see your buying price, supplier or stock counts. That is enforced in the database, not just hidden on the page.

You need two free accounts: **Supabase** (database and login) and **Vercel** (hosting). Setup takes about 30 minutes.

## 1. Create the database

1. Sign up at supabase.com and create a new project. Choose a region near you and save the database password.
2. Open **SQL Editor > New query**, paste the whole of `supabase/schema.sql`, and press **Run**. It is safe to run again if you change it later.

## 2. Create your admin login

1. In Supabase, open **Authentication > Users > Add user > Create new user**. Enter your email and a strong password. Tick "Auto Confirm User".
2. In **SQL Editor**, run this with your own email. It marks you as the shop admin:

```sql
insert into admins (user_id)
select id from auth.users where email = 'you@example.com';
```

3. Open **Authentication > Sign In / Providers** (or **Settings**) and turn **off** "Allow new users to sign up". Only people you add can then have a login. Add staff the same way as step 1, then run the SQL above with their email.

## 3. Connect the site

1. In Supabase open **Project Settings > API**. Copy the **Project URL** and the **anon public** key. Never use the `service_role` key.
2. Copy `.env.example` to `.env.local` and paste both values in.
3. Run it on your computer to try it:

```bash
npm install
npm run dev
```

Open http://localhost:3000 for the shop and http://localhost:3000/admin to sign in.

## 4. Put it online (Vercel)

1. Put this folder in a GitHub repository. `.gitignore` already keeps `.env.local` out.
2. At vercel.com choose **Add New > Project**, import the repository, and under **Environment Variables** add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Press **Deploy**. Vercel gives you an https address. Camera scanning only works over https, which Vercel provides.
4. In Supabase open **Authentication > URL Configuration** and set **Site URL** to your Vercel address.
5. Later you can attach your own domain under the Vercel project's **Domains** tab.

## Using it every day

**First day**
1. Sign in at `/admin`. On Overview, fill in the shop name, a contact line (address, hours, phone) and the message under the order button.
2. Add your products in either of two ways, on **Inventory**:
   - **Scan to add**: the camera opens, you scan the barcode, and a new product form opens with the barcode already filled in. Type the name and prices, then tap **Save and scan next** to carry on down the shelf. If you scan something you already have, that product opens instead.
   - **Add manually**: fill in the details by hand. **Save and add another** keeps the category and brand so a run of similar items is quick.
3. Photos are optional. You can add up to 6 per product: pick several at once or add them one by one. The first is the cover shown on the shop card. Tap **Make cover** to change it, or the cross to remove one. Customers swipe through them on the product page, and the product page shows the whole photo (nothing is cropped there). A product with no photo shows its category in the shop. A product shown in the shop needs a selling price; untick "Show in the customer shop" to keep one private.
4. To find things quickly, tap the sort icon on Inventory (under the search box). Choose price (low to high or high to low), most sold, stock, category (with a heading for each), newest first or name. It opens on price low to high and remembers your choice on that device. The **Category** box next to it shows one category only. Customers get the same sort icon above the products in the shop: price low to high (the default), price high to low, best selling, newest first or name. Sold-out items always sit at the end. "Best selling" appears in the shop after you run `supabase/best-sellers.sql` once in Supabase > SQL Editor (new installs already get it from `schema.sql`).

**When a delivery arrives**
1. Open **Receive** and tap **Scan items in**. Scan every item as it comes out of the box. The same product scanned again adds one more. You hear a beep for each read, and a low tone with a message if the barcode is unknown.
2. Fix any quantity with the plus and minus buttons, then tap **Add all to stock**. Barcodes the app does not know are listed, on the camera screen too, so you can create those products in one tap.

**Selling at the counter**
1. Open **Sell** and tap **Scan items**. Scan what the customer is buying. The total builds as you go. It refuses to sell more than you have in stock.
2. Tap **Complete sale**. Stock comes off at once and the sale is saved in Orders. Add a name and number first if you want the customer saved.

**Invoices**
1. Open **Overview > Invoice details** once and add your business name, address, phone and VAT number if you have one. Only you can see these settings. Add a thank-you or bank details line if you want.
2. When a customer asks for an invoice, open **Orders**, tap the order, then tap **Invoice**.
3. To email it, check the customer's email address in the box under the buttons (it is filled in if they gave one) and tap **Email invoice**. Your iPad's Mail app opens with the invoice already written. Check it and tap Send.
4. To send a PDF, tap **Print / Save PDF**. On the iPad choose Share, then Save to Files or send it by WhatsApp or as an email attachment. Or tap **Share as text** to send the invoice as a message.
4. A completed order shows "Paid in full". Any other order shows "Payment due on collection". If you are VAT registered, check with your accountant that this layout meets your needs.

**Online orders**
1. A new order shows on Overview and as a badge on **Orders**. Open it, check the details and tap **Confirm order**. Stock comes off at that point and the app will not confirm if you are short.
2. Move it on: Preparing, Ready, Completed. Cancel puts stock back.
3. Customers can follow progress at `/track` with their code and mobile number.

## Good to know

- Camera scanning needs a phone or laptop with a camera and the live https address. If the camera is blocked, type the code or use a scanner gun.
- Scanning works best with good light and the barcode held 10 to 20 cm away. Hold it still until you hear the beep, then move it away for a second to count it again.
- Online orders are not paid online. Customers pay when they collect. Card payments (Stripe) can be added later.
- Anyone can place an order, so a hidden spam trap is built in, but there is no strong rate limit. If you get spam, add a CAPTCHA or Vercel's firewall rules.
- Back up your data from time to time. Supabase **Database > Backups** shows what your plan includes.
- Product photos are stored in Supabase Storage in a public bucket called `product-photos`. The free plan has limited space, and photos are shrunk before upload.
