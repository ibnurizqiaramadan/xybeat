import { BackgroundDownloaderImpl } from './QueueWorker';

export const backgroundDownloader = new BackgroundDownloaderImpl();
export * from './types';
export * from './QueueWorker';
