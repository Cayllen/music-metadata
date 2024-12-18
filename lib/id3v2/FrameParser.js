import initDebug from 'debug';
import * as Token from 'token-types';
import * as util from '../common/Util.js';
import { AttachedPictureType, SyncTextHeader, TextEncodingToken, TextHeader } from './ID3v2Token.js';
import { Genres } from '../id3v1/ID3v1Parser.js';
import { makeUnexpectedFileContentError } from '../ParseError.js';
const debug = initDebug('music-metadata:id3v2:frame-parser');
const defaultEnc = 'latin1'; // latin1 == iso-8859-1;
export function parseGenre(origVal) {
    // match everything inside parentheses
    const genres = [];
    let code;
    let word = '';
    for (const c of origVal) {
        if (typeof code === 'string') {
            if (c === '(' && code === '') {
                word += '(';
                code = undefined;
            }
            else if (c === ')') {
                if (word !== '') {
                    genres.push(word);
                    word = '';
                }
                const genre = parseGenreCode(code);
                if (genre) {
                    genres.push(genre);
                }
                code = undefined;
            }
            else
                code += c;
        }
        else if (c === '(') {
            code = '';
        }
        else {
            word += c;
        }
    }
    if (word) {
        if (genres.length === 0 && word.match(/^\d*$/)) {
            word = parseGenreCode(word);
        }
        if (word) {
            genres.push(word);
        }
    }
    return genres;
}
function parseGenreCode(code) {
    if (code === 'RX')
        return 'Remix';
    if (code === 'CR')
        return 'Cover';
    if (code.match(/^\d*$/)) {
        return Genres[Number.parseInt(code)];
    }
}
export class FrameParser {
    /**
     * Create id3v2 frame parser
     * @param major - Major version, e.g. (4) for  id3v2.4
     * @param warningCollector - Used to collect decode issue
     */
    constructor(major, warningCollector) {
        this.major = major;
        this.warningCollector = warningCollector;
    }
    readData(uint8Array, type, includeCovers) {
        if (uint8Array.length === 0) {
            this.warningCollector.addWarning(`id3v2.${this.major} header has empty tag type=${type}`);
            return;
        }
        const { encoding, bom } = TextEncodingToken.get(uint8Array, 0);
        const length = uint8Array.length;
        let offset = 0;
        let output = []; // ToDo
        const nullTerminatorLength = FrameParser.getNullTerminatorLength(encoding);
        let fzero;
        debug(`Parsing tag type=${type}, encoding=${encoding}, bom=${bom}`);
        switch (type !== 'TXXX' && type[0] === 'T' ? 'T*' : type) {
            case 'T*': // 4.2.1. Text information frames - details
            case 'GRP1': // iTunes-specific ID3v2 grouping field
            case 'IPLS': // v2.3: Involved people list
            case 'MVIN':
            case 'MVNM':
            case 'PCS':
            case 'PCST': {
                let text;
                try {
                    text = util.decodeString(uint8Array.slice(1), encoding).replace(/\x00+$/, '');
                }
                catch (error) {
                    if (error instanceof Error) {
                        this.warningCollector.addWarning(`id3v2.${this.major} type=${type} header has invalid string value: ${error.message}`);
                        break;
                    }
                    throw error;
                }
                switch (type) {
                    case 'TMCL': // Musician credits list
                    case 'TIPL': // Involved people list
                    case 'IPLS': // Involved people list
                        output = FrameParser.functionList(this.splitValue(type, text));
                        break;
                    case 'TRK':
                    case 'TRCK':
                    case 'TPOS':
                        output = text;
                        break;
                    case 'TCOM':
                    case 'TEXT':
                    case 'TOLY':
                    case 'TOPE':
                    case 'TPE1':
                    case 'TSRC':
                        // id3v2.3 defines that TCOM, TEXT, TOLY, TOPE & TPE1 values are separated by /
                        output = this.splitValue(type, text);
                        break;
                    case 'TCO':
                    case 'TCON':
                        output = this.splitValue(type, text).map(v => parseGenre(v)).reduce((acc, val) => acc.concat(val), []);
                        break;
                    case 'PCS':
                    case 'PCST':
                        // TODO: Why `default` not results `1` but `''`?
                        output = this.major >= 4 ? this.splitValue(type, text) : [text];
                        output = (Array.isArray(output) && output[0] === '') ? 1 : 0;
                        break;
                    default:
                        output = this.major >= 4 ? this.splitValue(type, text) : [text];
                }
                break;
            }
            case 'TXXX': {
                const idAndData = FrameParser.readIdentifierAndData(uint8Array, offset + 1, length, encoding);
                const textTag = {
                    description: idAndData.id,
                    text: this.splitValue(type, util.decodeString(idAndData.data, encoding).replace(/\x00+$/, ''))
                };
                output = textTag;
                break;
            }
            case 'PIC':
            case 'APIC':
                if (includeCovers) {
                    const pic = {};
                    offset += 1;
                    switch (this.major) {
                        case 2:
                            pic.format = util.decodeString(uint8Array.slice(offset, offset + 3), 'latin1'); // 'latin1'; // latin1 == iso-8859-1;
                            offset += 3;
                            break;
                        case 3:
                        case 4:
                            fzero = util.findZero(uint8Array, offset, length, defaultEnc);
                            pic.format = util.decodeString(uint8Array.slice(offset, fzero), defaultEnc);
                            offset = fzero + 1;
                            break;
                        default:
                            throw makeUnexpectedMajorVersionError(this.major);
                    }
                    pic.format = FrameParser.fixPictureMimeType(pic.format);
                    pic.type = AttachedPictureType[uint8Array[offset]];
                    offset += 1;
                    fzero = util.findZero(uint8Array, offset, length, encoding);
                    pic.description = util.decodeString(uint8Array.slice(offset, fzero), encoding);
                    offset = fzero + nullTerminatorLength;
                    pic.data = uint8Array.slice(offset, length);
                    output = pic;
                }
                break;
            case 'CNT':
            case 'PCNT':
                output = Token.UINT32_BE.get(uint8Array, 0);
                break;
            case 'SYLT': {
                const syltHeader = SyncTextHeader.get(uint8Array, 0);
                offset += SyncTextHeader.len;
                const result = {
                    descriptor: '',
                    language: syltHeader.language,
                    contentType: syltHeader.contentType,
                    timeStampFormat: syltHeader.timeStampFormat,
                    syncText: []
                };
                let readSyllables = false;
                while (offset < length) {
                    const nullStr = FrameParser.readNullTerminatedString(uint8Array.subarray(offset), syltHeader.encoding);
                    offset += nullStr.len;
                    if (readSyllables) {
                        const timestamp = Token.UINT32_BE.get(uint8Array, offset);
                        offset += Token.UINT32_BE.len;
                        result.syncText.push({
                            text: nullStr.text,
                            timestamp
                        });
                    }
                    else {
                        result.descriptor = nullStr.text;
                        readSyllables = true;
                    }
                }
                output = result;
                break;
            }
            case 'ULT':
            case 'USLT':
            case 'COM':
            case 'COMM': {
                const textHeader = TextHeader.get(uint8Array, offset);
                offset += TextHeader.len;
                const descriptorStr = FrameParser.readNullTerminatedString(uint8Array.subarray(offset), textHeader.encoding);
                offset += descriptorStr.len;
                const textStr = FrameParser.readNullTerminatedString(uint8Array.subarray(offset), textHeader.encoding);
                const comment = {
                    language: textHeader.language,
                    descriptor: descriptorStr.text,
                    text: textStr.text
                };
                output = comment;
                break;
            }
            case 'UFID': {
                const ufid = FrameParser.readIdentifierAndData(uint8Array, offset, length, defaultEnc);
                output = { owner_identifier: ufid.id, identifier: ufid.data };
                break;
            }
            case 'PRIV': { // private frame
                const priv = FrameParser.readIdentifierAndData(uint8Array, offset, length, defaultEnc);
                output = { owner_identifier: priv.id, data: priv.data };
                break;
            }
            case 'POPM': { // Popularimeter
                fzero = util.findZero(uint8Array, offset, length, defaultEnc);
                const email = util.decodeString(uint8Array.slice(offset, fzero), defaultEnc);
                offset = fzero + 1;
                const dataLen = length - offset;
                output = {
                    email,
                    rating: Token.UINT8.get(uint8Array, offset),
                    counter: dataLen >= 5 ? Token.UINT32_BE.get(uint8Array, offset + 1) : undefined
                };
                break;
            }
            case 'GEOB': { // General encapsulated object
                fzero = util.findZero(uint8Array, offset + 1, length, encoding);
                const mimeType = util.decodeString(uint8Array.slice(offset + 1, fzero), defaultEnc);
                offset = fzero + 1;
                fzero = util.findZero(uint8Array, offset, length, encoding);
                const filename = util.decodeString(uint8Array.slice(offset, fzero), defaultEnc);
                offset = fzero + 1;
                fzero = util.findZero(uint8Array, offset, length, encoding);
                const description = util.decodeString(uint8Array.slice(offset, fzero), defaultEnc);
                offset = fzero + 1;
                const geob = {
                    type: mimeType,
                    filename,
                    description,
                    data: uint8Array.slice(offset, length)
                };
                output = geob;
                break;
            }
            // W-Frames:
            case 'WCOM':
            case 'WCOP':
            case 'WOAF':
            case 'WOAR':
            case 'WOAS':
            case 'WORS':
            case 'WPAY':
            case 'WPUB':
                // Decode URL
                fzero = util.findZero(uint8Array, offset + 1, length, encoding);
                output = util.decodeString(uint8Array.slice(offset, fzero), defaultEnc);
                break;
            case 'WXXX': {
                // Decode URL
                fzero = util.findZero(uint8Array, offset + 1, length, encoding);
                const description = util.decodeString(uint8Array.slice(offset + 1, fzero), encoding);
                offset = fzero + (encoding === 'utf-16le' ? 2 : 1);
                output = { description, url: util.decodeString(uint8Array.slice(offset, length), defaultEnc) };
                break;
            }
            case 'WFD':
            case 'WFED':
                output = util.decodeString(uint8Array.slice(offset + 1, util.findZero(uint8Array, offset + 1, length, encoding)), encoding);
                break;
            case 'MCDI': {
                // Music CD identifier
                output = uint8Array.slice(0, length);
                break;
            }
            default:
                debug(`Warning: unsupported id3v2-tag-type: ${type}`);
                break;
        }
        return output;
    }
    static readNullTerminatedString(uint8Array, encoding) {
        let offset = encoding.bom ? 2 : 0;
        const zeroIndex = util.findZero(uint8Array, offset, uint8Array.length, encoding.encoding);
        const txt = uint8Array.slice(offset, zeroIndex);
        if (encoding.encoding === 'utf-16le') {
            offset = zeroIndex + 2;
        }
        else {
            offset = zeroIndex + 1;
        }
        return {
            text: util.decodeString(txt, encoding.encoding),
            len: offset
        };
    }
    static fixPictureMimeType(pictureType) {
        pictureType = pictureType.toLocaleLowerCase();
        switch (pictureType) {
            case 'jpg':
                return 'image/jpeg';
            case 'png':
                return 'image/png';
        }
        return pictureType;
    }
    /**
     * Converts TMCL (Musician credits list) or TIPL (Involved people list)
     * @param entries
     */
    static functionList(entries) {
        const res = {};
        for (let i = 0; i + 1 < entries.length; i += 2) {
            const names = entries[i + 1].split(',');
            res[entries[i]] = res[entries[i]] ? res[entries[i]].concat(names) : names;
        }
        return res;
    }
    /**
     * id3v2.4 defines that multiple T* values are separated by 0x00
     * id3v2.3 defines that TCOM, TEXT, TOLY, TOPE & TPE1 values are separated by /
     * @param tag - Tag name
     * @param text - Concatenated tag value
     * @returns Split tag value
     */
    splitValue(tag, text) {
        let values;
        if (this.major < 4) {
            values = text.split(/\x00/g);
            if (values.length > 1) {
                this.warningCollector.addWarning(`ID3v2.${this.major} ${tag} uses non standard null-separator.`);
            }
            else {
                values = text.split(/\//g);
            }
        }
        else {
            values = text.split(/\x00/g);
        }
        return FrameParser.trimArray(values);
    }
    static trimArray(values) {
        return values.map(value => value.replace(/\x00+$/, '').trim());
    }
    static readIdentifierAndData(uint8Array, offset, length, encoding) {
        const fzero = util.findZero(uint8Array, offset, length, encoding);
        const id = util.decodeString(uint8Array.slice(offset, fzero), encoding);
        offset = fzero + FrameParser.getNullTerminatorLength(encoding);
        return { id, data: uint8Array.slice(offset, length) };
    }
    static getNullTerminatorLength(enc) {
        return enc === 'utf-16le' ? 2 : 1;
    }
}
export class Id3v2ContentError extends makeUnexpectedFileContentError('id3v2') {
}
function makeUnexpectedMajorVersionError(majorVer) {
    throw new Id3v2ContentError(`Unexpected majorVer: ${majorVer}`);
}
//# sourceMappingURL=FrameParser.js.map