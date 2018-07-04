//
// Copyright (c) 2014 The ANGLE Project Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
//
// UniformHLSL.cpp:
//   Methods for GLSL to HLSL translation for uniforms and uniform blocks.
//

#include "compiler/translator/UniformHLSL.h"

#include "common/utilities.h"
#include "compiler/translator/ImmutableStringBuilder.h"
#include "compiler/translator/StructureHLSL.h"
#include "compiler/translator/UtilsHLSL.h"
#include "compiler/translator/blocklayoutHLSL.h"
#include "compiler/translator/util.h"

namespace sh
{

namespace
{

constexpr const ImmutableString kAngleDecorString("angle_");

static const char *UniformRegisterPrefix(const TType &type)
{
    if (IsSampler(type.getBasicType()))
    {
        return "s";
    }
    else
    {
        return "c";
    }
}

static TString InterfaceBlockFieldTypeString(const TField &field, TLayoutBlockStorage blockStorage)
{
    const TType &fieldType                   = *field.type();
    const TLayoutMatrixPacking matrixPacking = fieldType.getLayoutQualifier().matrixPacking;
    ASSERT(matrixPacking != EmpUnspecified);
    const TStructure *structure = fieldType.getStruct();

    if (fieldType.isMatrix())
    {
        // Use HLSL row-major packing for GLSL column-major matrices
        const TString &matrixPackString =
            (matrixPacking == EmpRowMajor ? "column_major" : "row_major");
        return matrixPackString + " " + TypeString(fieldType);
    }
    else if (structure)
    {
        // Use HLSL row-major packing for GLSL column-major matrices
        return QualifiedStructNameString(*structure, matrixPacking == EmpColumnMajor,
                                         blockStorage == EbsStd140);
    }
    else
    {
        return TypeString(fieldType);
    }
}

static TString InterfaceBlockStructName(const TInterfaceBlock &interfaceBlock)
{
    return DecoratePrivate(interfaceBlock.name()) + "_type";
}

void OutputSamplerIndexArrayInitializer(TInfoSinkBase &out,
                                        const TType &type,
                                        unsigned int startIndex)
{
    out << "{";
    TType elementType(type);
    elementType.toArrayElementType();
    for (unsigned int i = 0u; i < type.getOutermostArraySize(); ++i)
    {
        if (i > 0u)
        {
            out << ", ";
        }
        if (elementType.isArray())
        {
            OutputSamplerIndexArrayInitializer(out, elementType,
                                               startIndex + i * elementType.getArraySizeProduct());
        }
        else
        {
            out << (startIndex + i);
        }
    }
    out << "}";
}

}  // anonymous namespace

UniformHLSL::UniformHLSL(sh::GLenum shaderType,
                         StructureHLSL *structureHLSL,
                         ShShaderOutput outputType,
                         const std::vector<Uniform> &uniforms,
                         unsigned int firstUniformRegister)
    : mUniformRegister(firstUniformRegister),
      mUniformBlockRegister(0),
      mTextureRegister(0),
      mRWTextureRegister(0),
      mSamplerCount(0),
      mShaderType(shaderType),
      mStructureHLSL(structureHLSL),
      mOutputType(outputType),
      mUniforms(uniforms)
{
}

void UniformHLSL::reserveUniformRegisters(unsigned int registerCount)
{
    mUniformRegister = registerCount;
}

void UniformHLSL::reserveUniformBlockRegisters(unsigned int registerCount)
{
    mUniformBlockRegister = registerCount;
}

const Uniform *UniformHLSL::findUniformByName(const ImmutableString &name) const
{
    for (size_t uniformIndex = 0; uniformIndex < mUniforms.size(); ++uniformIndex)
    {
        if (name == mUniforms[uniformIndex].name)
        {
            return &mUniforms[uniformIndex];
        }
    }

    return nullptr;
}

unsigned int UniformHLSL::assignUniformRegister(const TType &type,
                                                const ImmutableString &name,
                                                unsigned int *outRegisterCount)
{
    unsigned int registerIndex;
    const Uniform *uniform = findUniformByName(name);
    ASSERT(uniform);

    if (IsSampler(type.getBasicType()) ||
        (IsImage(type.getBasicType()) && type.getMemoryQualifier().readonly))
    {
        registerIndex = mTextureRegister;
    }
    else if (IsImage(type.getBasicType()))
    {
        registerIndex = mRWTextureRegister;
    }
    else
    {
        registerIndex = mUniformRegister;
    }

    mUniformRegisterMap[uniform->name] = registerIndex;

    unsigned int registerCount = HLSLVariableRegisterCount(*uniform, mOutputType);

    if (IsSampler(type.getBasicType()) ||
        (IsImage(type.getBasicType()) && type.getMemoryQualifier().readonly))
    {
        mTextureRegister += registerCount;
    }
    else if (IsImage(type.getBasicType()))
    {
        mRWTextureRegister += registerCount;
    }
    else
    {
        mUniformRegister += registerCount;
    }
    if (outRegisterCount)
    {
        *outRegisterCount = registerCount;
    }
    return registerIndex;
}

unsigned int UniformHLSL::assignSamplerInStructUniformRegister(const TType &type,
                                                               const TString &name,
                                                               unsigned int *outRegisterCount)
{
    // Sampler that is a field of a uniform structure.
    ASSERT(IsSampler(type.getBasicType()));
    unsigned int registerIndex                     = mTextureRegister;
    mUniformRegisterMap[std::string(name.c_str())] = registerIndex;
    unsigned int registerCount = type.isArray() ? type.getArraySizeProduct() : 1u;
    mTextureRegister += registerCount;
    if (outRegisterCount)
    {
        *outRegisterCount = registerCount;
    }
    return registerIndex;
}

void UniformHLSL::outputHLSLSamplerUniformGroup(
    TInfoSinkBase &out,
    const HLSLTextureGroup textureGroup,
    const TVector<const TVariable *> &group,
    const TMap<const TVariable *, TString> &samplerInStructSymbolsToAPINames,
    unsigned int *groupTextureRegisterIndex)
{
    if (group.empty())
    {
        return;
    }
    unsigned int groupRegisterCount = 0;
    for (const TVariable *uniform : group)
    {
        const TType &type   = uniform->getType();
        const ImmutableString &name = uniform->name();
        unsigned int registerCount;

        // The uniform might be just a regular sampler or one extracted from a struct.
        unsigned int samplerArrayIndex = 0u;
        const Uniform *uniformByName   = findUniformByName(name);
        if (uniformByName)
        {
            samplerArrayIndex = assignUniformRegister(type, name, &registerCount);
        }
        else
        {
            ASSERT(samplerInStructSymbolsToAPINames.find(uniform) !=
                   samplerInStructSymbolsToAPINames.end());
            samplerArrayIndex = assignSamplerInStructUniformRegister(
                type, samplerInStructSymbolsToAPINames.at(uniform), &registerCount);
        }
        groupRegisterCount += registerCount;

        if (type.isArray())
        {
            out << "static const uint " << DecorateVariableIfNeeded(*uniform) << ArrayString(type)
                << " = ";
            OutputSamplerIndexArrayInitializer(out, type, samplerArrayIndex);
            out << ";\n";
        }
        else
        {
            out << "static const uint " << DecorateVariableIfNeeded(*uniform) << " = "
                << samplerArrayIndex << ";\n";
        }
    }
    TString suffix = TextureGroupSuffix(textureGroup);
    // Since HLSL_TEXTURE_2D is the first group, it has a fixed offset of zero.
    if (textureGroup != HLSL_TEXTURE_2D)
    {
        out << "static const uint textureIndexOffset" << suffix << " = "
            << (*groupTextureRegisterIndex) << ";\n";
        out << "static const uint samplerIndexOffset" << suffix << " = "
            << (*groupTextureRegisterIndex) << ";\n";
    }
    out << "uniform " << TextureString(textureGroup) << " textures" << suffix << "["
        << groupRegisterCount << "]"
        << " : register(t" << (*groupTextureRegisterIndex) << ");\n";
    out << "uniform " << SamplerString(textureGroup) << " samplers" << suffix << "["
        << groupRegisterCount << "]"
        << " : register(s" << (*groupTextureRegisterIndex) << ");\n";
    *groupTextureRegisterIndex += groupRegisterCount;
}

void UniformHLSL::outputHLSL4_0_FL9_3Sampler(TInfoSinkBase &out,
                                             const TType &type,
                                             const TVariable &variable,
                                             const unsigned int registerIndex)
{
    out << "uniform " << SamplerString(type.getBasicType()) << " sampler_"
        << DecorateVariableIfNeeded(variable) << ArrayString(type) << " : register(s"
        << str(registerIndex) << ");\n";
    out << "uniform " << TextureString(type.getBasicType()) << " texture_"
        << DecorateVariableIfNeeded(variable) << ArrayString(type) << " : register(t"
        << str(registerIndex) << ");\n";
}

void UniformHLSL::outputHLSL4_1_FL11Texture(TInfoSinkBase &out,
                                            const TType &type,
                                            const TVariable &variable,
                                            const unsigned int registerIndex)
{
    // TODO(xinghua.cao@intel.com): if image2D variable is bound on one layer of Texture3D or
    // Texture2DArray. Translate this variable to HLSL Texture3D object or HLSL Texture2DArray
    // object, or create a temporary Texture2D to save content of the layer and bind the
    // temporary Texture2D to image2D variable.
    out << "uniform "
        << TextureString(type.getBasicType(), type.getLayoutQualifier().imageInternalFormat) << " "
        << DecorateVariableIfNeeded(variable) << ArrayString(type) << " : register(t"
        << str(registerIndex) << ");\n";
    return;
}

void UniformHLSL::outputHLSL4_1_FL11RWTexture(TInfoSinkBase &out,
                                              const TType &type,
                                              const TVariable &variable,
                                              const unsigned int registerIndex)
{
    // TODO(xinghua.cao@intel.com): if image2D variable is bound on one layer of Texture3D or
    // Texture2DArray. Translate this variable to HLSL RWTexture3D object or HLSL RWTexture2DArray
    // object, or create a temporary Texture2D to save content of the layer and bind the
    // temporary Texture2D to image2D variable.
    if (mShaderType == GL_COMPUTE_SHADER)
    {
        out << "uniform "
            << RWTextureString(type.getBasicType(), type.getLayoutQualifier().imageInternalFormat)
            << " " << DecorateVariableIfNeeded(variable) << ArrayString(type) << " : register(u"
            << str(registerIndex) << ");\n";
    }
    else
    {
        // TODO(xinghua.cao@intel.com): Support images in vertex shader and fragment shader,
        // which are needed to sync binding value when linking program.
    }
    return;
}

void UniformHLSL::outputUniform(TInfoSinkBase &out,
                                const TType &type,
                                const TVariable &variable,
                                const unsigned int registerIndex)
{
    const TStructure *structure = type.getStruct();
    // If this is a nameless struct, we need to use its full definition, rather than its (empty)
    // name.
    // TypeString() will invoke defineNameless in this case; qualifier prefixes are unnecessary for
    // nameless structs in ES, as nameless structs cannot be used anywhere that layout qualifiers
    // are permitted.
    const TString &typeName = ((structure && structure->symbolType() != SymbolType::Empty)
                                   ? QualifiedStructNameString(*structure, false, false)
                                   : TypeString(type));

    const TString &registerString =
        TString("register(") + UniformRegisterPrefix(type) + str(registerIndex) + ")";

    out << "uniform " << typeName << " ";

    out << DecorateVariableIfNeeded(variable);

    out << ArrayString(type) << " : " << registerString << ";\n";
}

void UniformHLSL::uniformsHeader(TInfoSinkBase &out,
                                 ShShaderOutput outputType,
                                 const ReferencedVariables &referencedUniforms,
                                 TSymbolTable *symbolTable)
{
    if (!referencedUniforms.empty())
    {
        out << "// Uniforms\n\n";
    }
    // In the case of HLSL 4, sampler uniforms need to be grouped by type before the code is
    // written. They are grouped based on the combination of the HLSL texture type and
    // HLSL sampler type, enumerated in HLSLTextureSamplerGroup.
    TVector<TVector<const TVariable *>> groupedSamplerUniforms(HLSL_TEXTURE_MAX + 1);
    TMap<const TVariable *, TString> samplerInStructSymbolsToAPINames;
    TVector<const TVariable *> imageUniformsHLSL41Output;
    for (auto &uniformIt : referencedUniforms)
    {
        // Output regular uniforms. Group sampler uniforms by type.
        const TVariable &variable = *uniformIt.second;
        const TType &type         = variable.getType();

        if (outputType == SH_HLSL_4_1_OUTPUT && IsSampler(type.getBasicType()))
        {
            HLSLTextureGroup group = TextureGroup(type.getBasicType());
            groupedSamplerUniforms[group].push_back(&variable);
        }
        else if (outputType == SH_HLSL_4_0_FL9_3_OUTPUT && IsSampler(type.getBasicType()))
        {
            unsigned int registerIndex = assignUniformRegister(type, variable.name(), nullptr);
            outputHLSL4_0_FL9_3Sampler(out, type, variable, registerIndex);
        }
        else if (outputType == SH_HLSL_4_1_OUTPUT && IsImage(type.getBasicType()))
        {
            imageUniformsHLSL41Output.push_back(&variable);
        }
        else
        {
            if (type.isStructureContainingSamplers())
            {
                TVector<const TVariable *> samplerSymbols;
                TMap<const TVariable *, TString> symbolsToAPINames;
                ImmutableStringBuilder namePrefix(kAngleDecorString.length() +
                                                  variable.name().length());
                namePrefix << kAngleDecorString;
                namePrefix << variable.name();
                type.createSamplerSymbols(namePrefix, TString(variable.name().data()),
                                          &samplerSymbols, &symbolsToAPINames, symbolTable);
                for (const TVariable *sampler : samplerSymbols)
                {
                    const TType &samplerType = sampler->getType();

                    if (outputType == SH_HLSL_4_1_OUTPUT)
                    {
                        HLSLTextureGroup group = TextureGroup(samplerType.getBasicType());
                        groupedSamplerUniforms[group].push_back(sampler);
                        samplerInStructSymbolsToAPINames[sampler] = symbolsToAPINames[sampler];
                    }
                    else if (outputType == SH_HLSL_4_0_FL9_3_OUTPUT)
                    {
                        unsigned int registerIndex = assignSamplerInStructUniformRegister(
                            samplerType, symbolsToAPINames[sampler], nullptr);
                        outputHLSL4_0_FL9_3Sampler(out, samplerType, *sampler, registerIndex);
                    }
                    else
                    {
                        ASSERT(outputType == SH_HLSL_3_0_OUTPUT);
                        unsigned int registerIndex = assignSamplerInStructUniformRegister(
                            samplerType, symbolsToAPINames[sampler], nullptr);
                        outputUniform(out, samplerType, *sampler, registerIndex);
                    }
                }
            }
            unsigned int registerIndex = assignUniformRegister(type, variable.name(), nullptr);
            outputUniform(out, type, variable, registerIndex);
        }
    }

    if (outputType == SH_HLSL_4_1_OUTPUT)
    {
        unsigned int groupTextureRegisterIndex = 0;
        // TEXTURE_2D is special, index offset is assumed to be 0 and omitted in that case.
        ASSERT(HLSL_TEXTURE_MIN == HLSL_TEXTURE_2D);
        for (int groupId = HLSL_TEXTURE_MIN; groupId < HLSL_TEXTURE_MAX; ++groupId)
        {
            outputHLSLSamplerUniformGroup(
                out, HLSLTextureGroup(groupId), groupedSamplerUniforms[groupId],
                samplerInStructSymbolsToAPINames, &groupTextureRegisterIndex);
        }
        mSamplerCount = groupTextureRegisterIndex;

        for (const TVariable *image : imageUniformsHLSL41Output)
        {
            const TType &type          = image->getType();
            unsigned int registerIndex = assignUniformRegister(type, image->name(), nullptr);
            if (type.getMemoryQualifier().readonly)
            {
                outputHLSL4_1_FL11Texture(out, type, *image, registerIndex);
            }
            else
            {
                outputHLSL4_1_FL11RWTexture(out, type, *image, registerIndex);
            }
        }
    }
}

void UniformHLSL::samplerMetadataUniforms(TInfoSinkBase &out, const char *reg)
{
    // If mSamplerCount is 0 the shader doesn't use any textures for samplers.
    if (mSamplerCount > 0)
    {
        out << "    struct SamplerMetadata\n"
               "    {\n"
               "        int baseLevel;\n"
               "        int internalFormatBits;\n"
               "        int wrapModes;\n"
               "        int padding;\n"
               "    };\n"
               "    SamplerMetadata samplerMetadata["
            << mSamplerCount << "] : packoffset(" << reg << ");\n";
    }
}

TString UniformHLSL::uniformBlocksHeader(const ReferencedInterfaceBlocks &referencedInterfaceBlocks)
{
    TString interfaceBlocks;

    for (const auto &blockReference : referencedInterfaceBlocks)
    {
        const TInterfaceBlock &interfaceBlock = *blockReference.second->block;
        const TVariable *instanceVariable     = blockReference.second->instanceVariable;
        if (instanceVariable != nullptr)
        {
            interfaceBlocks += uniformBlockStructString(interfaceBlock);
        }

        unsigned int activeRegister                             = mUniformBlockRegister;
        mUniformBlockRegisterMap[interfaceBlock.name().data()]  = activeRegister;

        if (instanceVariable != nullptr && instanceVariable->getType().isArray())
        {
            unsigned int instanceArraySize = instanceVariable->getType().getOutermostArraySize();
            for (unsigned int arrayIndex = 0; arrayIndex < instanceArraySize; arrayIndex++)
            {
                interfaceBlocks += uniformBlockString(interfaceBlock, instanceVariable,
                                                      activeRegister + arrayIndex, arrayIndex);
            }
            mUniformBlockRegister += instanceArraySize;
        }
        else
        {
            interfaceBlocks += uniformBlockString(interfaceBlock, instanceVariable, activeRegister,
                                                  GL_INVALID_INDEX);
            mUniformBlockRegister += 1u;
        }
    }

    return (interfaceBlocks.empty() ? "" : ("// Uniform Blocks\n\n" + interfaceBlocks));
}

TString UniformHLSL::uniformBlockString(const TInterfaceBlock &interfaceBlock,
                                        const TVariable *instanceVariable,
                                        unsigned int registerIndex,
                                        unsigned int arrayIndex)
{
    const TString &arrayIndexString = (arrayIndex != GL_INVALID_INDEX ? str(arrayIndex) : "");
    const TString &blockName        = TString(interfaceBlock.name().data()) + arrayIndexString;
    TString hlsl;

    hlsl += "cbuffer " + blockName + " : register(b" + str(registerIndex) +
            ")\n"
            "{\n";

    if (instanceVariable != nullptr)
    {
        hlsl += "    " + InterfaceBlockStructName(interfaceBlock) + " " +
                UniformBlockInstanceString(instanceVariable->name(), arrayIndex) + ";\n";
    }
    else
    {
        const TLayoutBlockStorage blockStorage = interfaceBlock.blockStorage();
        hlsl += uniformBlockMembersString(interfaceBlock, blockStorage);
    }

    hlsl += "};\n\n";

    return hlsl;
}

TString UniformHLSL::UniformBlockInstanceString(const ImmutableString &instanceName,
                                                unsigned int arrayIndex)
{
    if (arrayIndex != GL_INVALID_INDEX)
    {
        return DecoratePrivate(instanceName) + "_" + str(arrayIndex);
    }
    else
    {
        return Decorate(instanceName);
    }
}

TString UniformHLSL::uniformBlockMembersString(const TInterfaceBlock &interfaceBlock,
                                               TLayoutBlockStorage blockStorage)
{
    TString hlsl;

    Std140PaddingHelper padHelper = mStructureHLSL->getPaddingHelper();

    for (unsigned int typeIndex = 0; typeIndex < interfaceBlock.fields().size(); typeIndex++)
    {
        const TField &field    = *interfaceBlock.fields()[typeIndex];
        const TType &fieldType = *field.type();

        if (blockStorage == EbsStd140)
        {
            // 2 and 3 component vector types in some cases need pre-padding
            hlsl += padHelper.prePaddingString(fieldType);
        }

        hlsl += "    " + InterfaceBlockFieldTypeString(field, blockStorage) + " " +
                Decorate(field.name()) + ArrayString(fieldType) + ";\n";

        // must pad out after matrices and arrays, where HLSL usually allows itself room to pack
        // stuff
        if (blockStorage == EbsStd140)
        {
            const bool useHLSLRowMajorPacking =
                (fieldType.getLayoutQualifier().matrixPacking == EmpColumnMajor);
            hlsl += padHelper.postPaddingString(fieldType, useHLSLRowMajorPacking);
        }
    }

    return hlsl;
}

TString UniformHLSL::uniformBlockStructString(const TInterfaceBlock &interfaceBlock)
{
    const TLayoutBlockStorage blockStorage = interfaceBlock.blockStorage();

    return "struct " + InterfaceBlockStructName(interfaceBlock) +
           "\n"
           "{\n" +
           uniformBlockMembersString(interfaceBlock, blockStorage) + "};\n\n";
}
}
