import { type IVorbisPicture } from './Vorbis.js';
import type { IPageConsumer, IPageHeader } from '../Ogg.js';
import type { IOptions } from '../../type.js';
import type { INativeMetadataCollector } from '../../common/MetadataCollector.js';
declare const VorbisContentError_base: {
    new (message: string): {
        readonly fileType: string;
        toString(): string;
        name: "UnexpectedFileContentError";
        message: string;
        stack?: string;
    };
    captureStackTrace(targetObject: object, constructorOpt?: Function): void;
    prepareStackTrace?: ((err: Error, stackTraces: NodeJS.CallSite[]) => any) | undefined;
    stackTraceLimit: number;
};
export declare class VorbisContentError extends VorbisContentError_base {
}
/**
 * Vorbis 1 Parser.
 * Used by OggParser
 */
export declare class VorbisParser implements IPageConsumer {
    protected metadata: INativeMetadataCollector;
    protected options: IOptions;
    private pageSegments;
    constructor(metadata: INativeMetadataCollector, options: IOptions);
    /**
     * Vorbis 1 parser
     * @param header Ogg Page Header
     * @param pageData Page data
     */
    parsePage(header: IPageHeader, pageData: Uint8Array): Promise<void>;
    private static mergeUint8Arrays;
    flush(): Promise<void>;
    parseUserComment(pageData: Uint8Array, offset: number): Promise<number>;
    addTag(id: string, value: string | IVorbisPicture): Promise<void>;
    calculateDuration(header: IPageHeader): void;
    /**
     * Parse first Ogg/Vorbis page
     * @param header
     * @param pageData
     */
    protected parseFirstPage(header: IPageHeader, pageData: Uint8Array): void;
    protected parseFullPage(pageData: Uint8Array): Promise<void>;
    /**
     * Ref: https://xiph.org/vorbis/doc/Vorbis_I_spec.html#x1-840005.2
     */
    protected parseUserCommentList(pageData: Uint8Array, offset: number): Promise<void>;
}
export {};
