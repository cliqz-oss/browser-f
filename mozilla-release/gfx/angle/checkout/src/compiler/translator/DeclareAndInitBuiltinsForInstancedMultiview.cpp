//
// Copyright (c) 2017 The ANGLE Project Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
//
// Applies the necessary AST transformations to support multiview rendering through instancing.
// Check the header file For more information.
//

#include "compiler/translator/DeclareAndInitBuiltinsForInstancedMultiview.h"

#include "compiler/translator/FindMain.h"
#include "compiler/translator/InitializeVariables.h"
#include "compiler/translator/IntermNode_util.h"
#include "compiler/translator/IntermTraverse.h"
#include "compiler/translator/ReplaceVariable.h"
#include "compiler/translator/StaticType.h"
#include "compiler/translator/SymbolTable.h"
#include "compiler/translator/util.h"

namespace sh
{

namespace
{

constexpr const ImmutableString kGlLayerString("gl_Layer");
constexpr const ImmutableString kGlViewportIndexString("gl_ViewportIndex");
constexpr const ImmutableString kGlViewIdOVRString("gl_ViewID_OVR");
constexpr const ImmutableString kGlInstanceIdString("gl_InstanceID");
constexpr const ImmutableString kViewIDVariableName("ViewID_OVR");
constexpr const ImmutableString kInstanceIDVariableName("InstanceID");
constexpr const ImmutableString kMultiviewBaseViewLayerIndexVariableName(
    "multiviewBaseViewLayerIndex");

TIntermSymbol *CreateGLInstanceIDSymbol(const TSymbolTable &symbolTable)
{
    return ReferenceBuiltInVariable(kGlInstanceIdString, symbolTable, 300);
}

// Adds the InstanceID and ViewID_OVR initializers to the end of the initializers' sequence.
void InitializeViewIDAndInstanceID(const TVariable *viewID,
                                   const TVariable *instanceID,
                                   unsigned numberOfViews,
                                   const TSymbolTable &symbolTable,
                                   TIntermSequence *initializers)
{
    // Create an unsigned numberOfViews node.
    TConstantUnion *numberOfViewsUnsignedConstant = new TConstantUnion();
    numberOfViewsUnsignedConstant->setUConst(numberOfViews);
    TIntermConstantUnion *numberOfViewsUint =
        new TIntermConstantUnion(numberOfViewsUnsignedConstant, TType(EbtUInt, EbpHigh, EvqConst));

    // Create a uint(gl_InstanceID) node.
    TIntermSequence *glInstanceIDSymbolCastArguments = new TIntermSequence();
    glInstanceIDSymbolCastArguments->push_back(CreateGLInstanceIDSymbol(symbolTable));
    TIntermAggregate *glInstanceIDAsUint = TIntermAggregate::CreateConstructor(
        TType(EbtUInt, EbpHigh, EvqTemporary), glInstanceIDSymbolCastArguments);

    // Create a uint(gl_InstanceID) / numberOfViews node.
    TIntermBinary *normalizedInstanceID =
        new TIntermBinary(EOpDiv, glInstanceIDAsUint, numberOfViewsUint);

    // Create an int(uint(gl_InstanceID) / numberOfViews) node.
    TIntermSequence *normalizedInstanceIDCastArguments = new TIntermSequence();
    normalizedInstanceIDCastArguments->push_back(normalizedInstanceID);
    TIntermAggregate *normalizedInstanceIDAsInt = TIntermAggregate::CreateConstructor(
        TType(EbtInt, EbpHigh, EvqTemporary), normalizedInstanceIDCastArguments);

    // Create an InstanceID = int(uint(gl_InstanceID) / numberOfViews) node.
    TIntermBinary *instanceIDInitializer =
        new TIntermBinary(EOpAssign, new TIntermSymbol(instanceID), normalizedInstanceIDAsInt);
    initializers->push_back(instanceIDInitializer);

    // Create a uint(gl_InstanceID) % numberOfViews node.
    TIntermBinary *normalizedViewID =
        new TIntermBinary(EOpIMod, glInstanceIDAsUint->deepCopy(), numberOfViewsUint->deepCopy());

    // Create a ViewID_OVR = uint(gl_InstanceID) % numberOfViews node.
    TIntermBinary *viewIDInitializer =
        new TIntermBinary(EOpAssign, new TIntermSymbol(viewID), normalizedViewID);
    initializers->push_back(viewIDInitializer);
}

void DeclareGlobalVariable(TIntermBlock *root, const TVariable *variable)
{
    TIntermDeclaration *declaration = new TIntermDeclaration();
    declaration->appendDeclarator(new TIntermSymbol(variable));

    TIntermSequence *globalSequence = root->getSequence();
    globalSequence->insert(globalSequence->begin(), declaration);
}

// Adds a branch to write int(ViewID_OVR) to either gl_ViewportIndex or gl_Layer. The branch is
// added to the end of the initializers' sequence.
void SelectViewIndexInVertexShader(const TVariable *viewID,
                                   const TVariable *multiviewBaseViewLayerIndex,
                                   TIntermSequence *initializers,
                                   const TSymbolTable &symbolTable)
{
    // Create an int(ViewID_OVR) node.
    TIntermSequence *viewIDSymbolCastArguments = new TIntermSequence();
    viewIDSymbolCastArguments->push_back(new TIntermSymbol(viewID));
    TIntermAggregate *viewIDAsInt = TIntermAggregate::CreateConstructor(
        TType(EbtInt, EbpHigh, EvqTemporary), viewIDSymbolCastArguments);

    // Create a gl_ViewportIndex node.
    TIntermSymbol *viewportIndexSymbol =
        ReferenceBuiltInVariable(kGlViewportIndexString, symbolTable, 0);

    // Create a { gl_ViewportIndex = int(ViewID_OVR) } node.
    TIntermBlock *viewportIndexInitializerInBlock = new TIntermBlock();
    viewportIndexInitializerInBlock->appendStatement(
        new TIntermBinary(EOpAssign, viewportIndexSymbol, viewIDAsInt));

    // Create a gl_Layer node.
    TIntermSymbol *layerSymbol = ReferenceBuiltInVariable(kGlLayerString, symbolTable, 0);

    // Create an int(ViewID_OVR) + multiviewBaseViewLayerIndex node
    TIntermBinary *sumOfViewIDAndBaseViewIndex = new TIntermBinary(
        EOpAdd, viewIDAsInt->deepCopy(), new TIntermSymbol(multiviewBaseViewLayerIndex));

    // Create a { gl_Layer = int(ViewID_OVR) + multiviewBaseViewLayerIndex } node.
    TIntermBlock *layerInitializerInBlock = new TIntermBlock();
    layerInitializerInBlock->appendStatement(
        new TIntermBinary(EOpAssign, layerSymbol, sumOfViewIDAndBaseViewIndex));

    // Create a node to compare whether the base view index uniform is less than zero.
    TIntermBinary *multiviewBaseViewLayerIndexZeroComparison =
        new TIntermBinary(EOpLessThan, new TIntermSymbol(multiviewBaseViewLayerIndex),
                          CreateZeroNode(TType(EbtInt, EbpHigh, EvqConst)));

    // Create an if-else statement to select the code path.
    TIntermIfElse *multiviewBranch =
        new TIntermIfElse(multiviewBaseViewLayerIndexZeroComparison,
                          viewportIndexInitializerInBlock, layerInitializerInBlock);

    initializers->push_back(multiviewBranch);
}

}  // namespace

void DeclareAndInitBuiltinsForInstancedMultiview(TIntermBlock *root,
                                                 unsigned numberOfViews,
                                                 GLenum shaderType,
                                                 ShCompileOptions compileOptions,
                                                 ShShaderOutput shaderOutput,
                                                 TSymbolTable *symbolTable)
{
    ASSERT(shaderType == GL_VERTEX_SHADER || shaderType == GL_FRAGMENT_SHADER);

    TQualifier viewIDQualifier  = (shaderType == GL_VERTEX_SHADER) ? EvqFlatOut : EvqFlatIn;
    const TVariable *viewID =
        new TVariable(symbolTable, kViewIDVariableName,
                      new TType(EbtUInt, EbpHigh, viewIDQualifier), SymbolType::AngleInternal);

    DeclareGlobalVariable(root, viewID);
    ReplaceVariable(
        root,
        static_cast<const TVariable *>(symbolTable->findBuiltIn(kGlViewIdOVRString, 300, true)),
        viewID);
    if (shaderType == GL_VERTEX_SHADER)
    {
        // Replacing gl_InstanceID with InstanceID should happen before adding the initializers of
        // InstanceID and ViewID.
        const TType *instanceIDVariableType   = StaticType::Get<EbtInt, EbpHigh, EvqGlobal, 1, 1>();
        const TVariable *instanceID =
            new TVariable(symbolTable, kInstanceIDVariableName, instanceIDVariableType,
                          SymbolType::AngleInternal);
        DeclareGlobalVariable(root, instanceID);
        ReplaceVariable(root,
                        static_cast<const TVariable *>(
                            symbolTable->findBuiltIn(kGlInstanceIdString, 300, true)),
                        instanceID);

        TIntermSequence *initializers = new TIntermSequence();
        InitializeViewIDAndInstanceID(viewID, instanceID, numberOfViews, *symbolTable,
                                      initializers);

        // The AST transformation which adds the expression to select the viewport index should
        // be done only for the GLSL and ESSL output.
        const bool selectView = (compileOptions & SH_SELECT_VIEW_IN_NV_GLSL_VERTEX_SHADER) != 0u;
        // Assert that if the view is selected in the vertex shader, then the output is
        // either GLSL or ESSL.
        ASSERT(!selectView || IsOutputGLSL(shaderOutput) || IsOutputESSL(shaderOutput));
        if (selectView)
        {
            // Add a uniform to switch between side-by-side and layered rendering.
            const TType *baseLayerIndexVariableType =
                StaticType::Get<EbtInt, EbpHigh, EvqUniform, 1, 1>();
            const TVariable *multiviewBaseViewLayerIndex =
                new TVariable(symbolTable, kMultiviewBaseViewLayerIndexVariableName,
                              baseLayerIndexVariableType, SymbolType::AngleInternal);
            DeclareGlobalVariable(root, multiviewBaseViewLayerIndex);

            // Setting a value to gl_ViewportIndex or gl_Layer should happen after ViewID_OVR's
            // initialization.
            SelectViewIndexInVertexShader(viewID, multiviewBaseViewLayerIndex, initializers,
                                          *symbolTable);
        }

        // Insert initializers at the beginning of main().
        TIntermBlock *initializersBlock = new TIntermBlock();
        initializersBlock->getSequence()->swap(*initializers);
        TIntermBlock *mainBody = FindMainBody(root);
        mainBody->getSequence()->insert(mainBody->getSequence()->begin(), initializersBlock);
    }
}

}  // namespace sh