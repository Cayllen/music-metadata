import type { IGetToken } from 'strtok3';
/**
 * Opus ID Header interface
 * Ref: https://wiki.xiph.org/OggOpus#ID_Header
 */
export interface IIdHeader {
    /**
     * Magic signature: "OpusHead" (64 bits)
     */
    magicSignature: string;
    /**
     * Version number (8 bits unsigned): 0x01 for this spec
     */
    version: number;
    /**
     * Channel count 'c' (8 bits unsigned): MUST be > 0
     */
    channelCount: number;
    /**
     * Pre-skip (16 bits unsigned, little endian)
     */
    preSkip: number;
    /**
     * Input sample rate (32 bits unsigned, little endian): informational only
     */
    inputSampleRate: number;
    /**
     * Output gain (16 bits, little endian, signed Q7.8 in dB) to apply when decoding
     */
    outputGain: number;
    /**
     * Channel mapping family (8 bits unsigned)
     * -  0 = one stream: mono or L,R stereo
     * -  1 = channels in vorbis spec order: mono or L,R stereo or ... or FL,C,FR,RL,RR,LFE, ...
     * -  2..254 = reserved (treat as 255)
     * -  255 = no defined channel meaning
     */
    channelMapping: number;
}
declare const OpusContentError_base: {
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
export declare class OpusContentError extends OpusContentError_base {
}
/**
 * Opus ID Header parser
 * Ref: https://wiki.xiph.org/OggOpus#ID_Header
 */
export declare class IdHeader implements IGetToken<IIdHeader> {
    len: number;
    constructor(len: number);
    get(buf: Uint8Array, off: number): IIdHeader;
}
export {};
