/**
 * Node.js specific entry point.
 */
import { fromFile, fromStream } from 'strtok3';
import initDebug from 'debug';
import { parseFromTokenizer, scanAppendingHeaders } from './core.js';
import { ParserFactory } from './ParserFactory.js';
import { RandomFileReader } from './common/RandomFileReader.js';
export * from './core.js';
const debug = initDebug('music-metadata:parser');
/**
 * Parse audio from Node Stream.Readable
 * @param stream - Stream to read the audio track from
 * @param fileInfo - File information object or MIME-type, e.g.: 'audio/mpeg'
 * @param options - Parsing options
 * @returns Metadata
 */
export async function parseStream(stream, fileInfo, options = {}) {
    const tokenizer = await fromStream(stream, { fileInfo: typeof fileInfo === 'string' ? { mimeType: fileInfo } : fileInfo });
    return parseFromTokenizer(tokenizer, options);
}
/**
 * Parse audio from Node file
 * @param filePath - Media file to read meta-data from
 * @param options - Parsing options
 * @returns Metadata
 */
export async function parseFile(filePath, options = {}) {
    debug(`parseFile: ${filePath}`);
    const fileTokenizer = await fromFile(filePath);
    const fileReader = await RandomFileReader.init(filePath, fileTokenizer.fileInfo.size);
    try {
        await scanAppendingHeaders(fileReader, options);
    }
    finally {
        await fileReader.close();
    }
    const parserFactory = new ParserFactory();
    try {
        const parserLoader = parserFactory.findLoaderForExtension(filePath);
        if (!parserLoader)
            debug(' Parser could not be determined by file extension');
        return await parserFactory.parse(fileTokenizer, parserLoader, options);
    }
    finally {
        await fileTokenizer.close();
    }
}
