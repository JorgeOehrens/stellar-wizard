# Supabase Setup for Image Upload

## Steps to configure Supabase for image storage:

### 1. Create Supabase Project
1. Go to https://app.supabase.com/
2. Sign up or log in
3. Click "New Project"
4. Choose your organization
5. Enter project name (e.g., "stellar-wizard")
6. Choose a database password
7. Select region
8. Click "Create new project"

### 2. Get API Keys
1. In your Supabase dashboard, go to Settings → API
2. Copy the "Project URL" and "anon public" key
3. Add these to your `.env.local` file:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_project_url_here
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
   ```

### 3. Create Storage Bucket
1. In Supabase dashboard, go to Storage
2. Click "Create a new bucket"
3. Name: `images`
4. Set as Public bucket: Yes
5. Click "Create bucket"

### 4. Configure Bucket Policies
1. Go to Storage → images bucket
2. Click "Policies" tab
3. Add policy for public access:
   - Policy name: "Public read access"
   - Allowed operation: SELECT
   - Target roles: public
   - Policy definition: `true`

4. Add policy for public upload:
   - Policy name: "Public upload access"
   - Allowed operation: INSERT
   - Target roles: public
   - Policy definition: `true`

### 5. Test Configuration
1. Start your Next.js development server: `npm run dev`
2. Navigate to the NFT Creator
3. When prompted for an image, try uploading a file
4. The image should upload to Supabase and get styled automatically

## Environment Variables Needed
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
OPENAI_API_KEY=your-openai-api-key-here
```

## Troubleshooting
- If upload fails, check browser console for errors
- Verify bucket name is exactly "images"
- Ensure bucket policies allow public read/write
- Confirm environment variables are set correctly