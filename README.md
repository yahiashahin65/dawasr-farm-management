# Dawasr Farm Management

Next.js app for managing farm assets, workers, and equipment custody with Firebase Firestore and Cloudinary image uploads.

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Environment Variables

```env
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=dneyloara
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=dawasr-farm
```

## Firebase Firestore Test Rules

Use only for testing:

```js
allow read, write: if true;
```

Later use authenticated rules:

```js
allow read, write: if request.auth != null;
```
