type ApiRequest = {
    method?: string;
    body?: any;
};

type ApiResponse = {
    status: (code: number) => { json: (payload: unknown) => void };
};

import { handleUploadRequest } from './uploadHandler';

export const config = {
    api: {
        bodyParser: true,
    },
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
    const { status, payload } = await handleUploadRequest(req.method, req.body, {
        accountId: process.env.VITE_R2_ACCOUNT_ID,
        accessKeyId: process.env.VITE_R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.VITE_R2_SECRET_ACCESS_KEY,
        publicUrlBase: process.env.VITE_R2_PUBLIC_URL,
    });

    return res.status(status).json(payload);
}
