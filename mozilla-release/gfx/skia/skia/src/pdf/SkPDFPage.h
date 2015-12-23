
/*
 * Copyright 2010 The Android Open Source Project
 *
 * Use of this source code is governed by a BSD-style license that can be
 * found in the LICENSE file.
 */


#ifndef SkPDFPage_DEFINED
#define SkPDFPage_DEFINED

#include "SkPDFTypes.h"
#include "SkPDFStream.h"
#include "SkRefCnt.h"
#include "SkTDArray.h"

class SkPDFCatalog;
class SkPDFDevice;
class SkWStream;

/** \class SkPDFPage

    A SkPDFPage contains meta information about a page, is used in the page
    tree and points to the content of the page.
*/
class SkPDFPage : public SkPDFDict {
    SK_DECLARE_INST_COUNT(SkPDFPage)
public:
    /** Create a PDF page with the passed PDF device.  The device need not
     *  have content on it yet.
     *  @param content    The page content.
     */
    explicit SkPDFPage(SkPDFDevice* content);
    ~SkPDFPage();

    /** Before a page and its contents can be sized and emitted, it must
     *  be finalized.  No changes to the PDFDevice will be honored after
     *  finalizePage has been called.  This function adds the page content
     *  to the passed catalog, so it must be called for each document
     *  that the page is part of.
     *  @param catalog         The catalog to add page content objects to.
     *  @param firstPage       Indicate if this is the first page of a document.
     *  @param newResourceObjects All the resource objects (recursively) used on
     *                         the page are added to this array.  This gives
     *                         the caller a chance to deduplicate resources
     *                         across pages.
     *  @param knownResourceObjects  The set of resources to be ignored.
     */
    void finalizePage(SkPDFCatalog* catalog, bool firstPage,
                      const SkTSet<SkPDFObject*>& knownResourceObjects,
                      SkTSet<SkPDFObject*>* newResourceObjects);

    /** Add destinations for this page to the supplied dictionary.
     *  @param dict       Dictionary to add destinations to.
     */
    void appendDestinations(SkPDFDict* dict);

    /** Determine the size of the page content and store to the catalog
     *  the offsets of all nonresource-indirect objects that make up the page
     *  content.  This must be called before emitPage(), but after finalizePage.
     *  @param catalog    The catalog to add the object offsets to.
     *  @param fileOffset The file offset where the page content will be
     *                    emitted.
     */
    off_t getPageSize(SkPDFCatalog* catalog, off_t fileOffset);

    /** Output the page content to the passed stream.
     *  @param stream     The writable output stream to send the content to.
     *  @param catalog    The active object catalog.
     */
    void emitPage(SkWStream* stream, SkPDFCatalog* catalog);

    /** Generate a page tree for the passed vector of pages.  New objects are
     *  added to the catalog.  The pageTree vector is populated with all of
     *  the 'Pages' dictionaries as well as the 'Page' objects.  Page trees
     *  have both parent and children links, creating reference cycles, so
     *  it must be torn down explicitly.  The first page is not added to
     *  the pageTree dictionary array so the caller can handle it specially.
     *  @param pages      The ordered vector of page objects.
     *  @param catalog    The catalog to add new objects into.
     *  @param pageTree   An output vector with all of the internal and leaf
     *                    nodes of the pageTree.
     *  @param rootNode   An output parameter set to the root node.
     */
    static void GeneratePageTree(const SkTDArray<SkPDFPage*>& pages,
                                 SkPDFCatalog* catalog,
                                 SkTDArray<SkPDFDict*>* pageTree,
                                 SkPDFDict** rootNode);

    /** Get the fonts used on this page.
     */
    const SkTDArray<SkPDFFont*>& getFontResources() const;

    /** Returns a SkPDFGlyphSetMap which represents glyph usage of every font
     *  that shows on this page.
     */
    const SkPDFGlyphSetMap& getFontGlyphUsage() const;

private:
    // Multiple pages may reference the content.
    SkAutoTUnref<SkPDFDevice> fDevice;

    // Once the content is finalized, put it into a stream for output.
    SkAutoTUnref<SkPDFStream> fContentStream;
    typedef SkPDFDict INHERITED;
};

#endif
