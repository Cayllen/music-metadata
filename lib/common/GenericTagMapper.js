export class CommonTagMapper {
    static toIntOrNull(str) {
        const cleaned = Number.parseInt(str, 10);
        return Number.isNaN(cleaned) ? null : cleaned;
    }
    // TODO: a string of 1of1 would fail to be converted
    // converts 1/10 to no : 1, of : 10
    // or 1 to no : 1, of : 0
    static normalizeTrack(origVal) {
        const split = origVal.toString().split('/');
        return {
            no: Number.parseInt(split[0], 10) || null,
            of: Number.parseInt(split[1], 10) || null
        };
    }
    constructor(tagTypes, tagMap) {
        this.tagTypes = tagTypes;
        this.tagMap = tagMap;
    }
    /**
     * Process and set common tags
     * write common tags to
     * @param tag Native tag
     * @param warnings Register warnings
     * @return common name
     */
    mapGenericTag(tag, warnings) {
        tag = { id: tag.id, value: tag.value }; // clone object
        this.postMap(tag, warnings);
        // Convert native tag event to generic 'alias' tag
        const id = this.getCommonName(tag.id);
        return id ? { id, value: tag.value } : null;
    }
    /**
     * Convert native tag key to common tag key
     * @param tag Native header tag
     * @return common tag name (alias)
     */
    getCommonName(tag) {
        return this.tagMap[tag];
    }
    /**
     * Handle post mapping exceptions / correction
     * @param tag Tag e.g. {"©alb", "Buena Vista Social Club")
     * @param warnings Used to register warnings
     */
    postMap(tag, warnings) {
        return;
    }
}
CommonTagMapper.maxRatingScore = 1;
//# sourceMappingURL=GenericTagMapper.js.map