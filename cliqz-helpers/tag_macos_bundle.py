import codecs
import json
import os
import sys
import xml.dom.minidom as minidom

from sets import Set
from subprocess import check_call

"""
Creates DMGs with tagged MacOS bundles.

First argument must be a file path to original bundle.

Second - signing entity name (used by `codesign` command).

The rest of arguments are treated as a list of tags.
For each tag a separate DMG is produced by writing it to bundle Info.plist file
into the key specified by the constant `DIST_TAG_KEY_NAME` below.

DMG files are put near the original bundle.
"""

DIST_TAG_KEY_NAME = "CQZDistributionTag"
BUNDLE_NAME_KEY_NAME = "CFBundleName"
DIST_PREF_TPL = 'pref("extensions.cliqz.distribution", "%s");'

def genFilter(seq, test):
    for el in seq:
        if test(el):
            yield el

def firstIn(gen):
    try:
        return gen.next()
    except StopIteration:
        return None

def findNode(nodeIter, test):
    return firstIn(genFilter(nodeIter, test))

def namedElementTest(name):
    return lambda e : e.nodeName == name

def elements(nodeIter):
    return genFilter(nodeIter, lambda n : (n.nodeType == n.ELEMENT_NODE))

def childElementsNamed(nodeIter, name):
    return genFilter(elements(nodeIter), namedElementTest(name))

def siblingsForward(node):
    while node:
        node = node.nextSibling
        if node:
            yield node

def getPlistKeyValueNodes(plistDoc, keyName):
    VALUE_TAGS = Set(["string", "real", "integer", "true", "false", "date",
        "data", "array", "dict"])

    dictElem = findNode(plistDoc.documentElement.childNodes,
                        namedElementTest("dict"))
    keys = childElementsNamed(dictElem.childNodes, "key")
    keyElement = findNode(keys,
        lambda k : k.firstChild.nodeValue == keyName)
    valueElement = None
    if keyElement:
        valueElement = firstIn(elements(siblingsForward(keyElement)))
        if valueElement and (not valueElement.nodeName in VALUE_TAGS):
            valueElement = None
    return (keyElement, valueElement)

def getPlistValue(plistDoc, name):
    keyEl, valEl = getPlistKeyValueNodes(plistDoc, name)
    if valEl is None:
        return None
    return valEl.firstChild.nodeValue

def tagPList(plistDoc, tag):
    dictElem = findNode(plistDoc.documentElement.childNodes,
                        namedElementTest("dict"))

    # Find distribution label elements:
    distTagKeyEl, distTagValEl = \
        getPlistKeyValueNodes(plistDoc, DIST_TAG_KEY_NAME)

    # Create elements if they are absent
    if distTagKeyEl is None:
        distTagKeyEl = plistDoc.createElement("key")
        distTagKeyEl.appendChild(plistDoc.createTextNode(DIST_TAG_KEY_NAME))
        dictElem.appendChild(distTagKeyEl)
    if distTagValEl is None:
        distTagValEl = plistDoc.createElement("string")
        distTagValEl.appendChild(plistDoc.createTextNode(""))
        distTagKeyEl.parentNode.insertBefore(distTagValEl,
            distTagKeyEl.nextSibling)

    # Rewrite tag.
    distTagValEl.firstChild.nodeValue = tag

def signBundle(bundlePath, entityName):
    check_call(["codesign", "-s", entityName, "--force", "--deep", bundlePath])

def packBundle(bundlePath, dmgJson, bundleName, tagName):
    bundleDir = os.path.dirname(bundlePath)
    dmgJsonFileName = "dmg-%s-%s.json" % (bundleName, tagName)
    dmgJsonPath = os.path.join(bundleDir, dmgJsonFileName)
    dmgJson["title"] = bundleName
    dmgJson["contents"][1]["path"] = bundlePath
    with open(dmgJsonPath, "w") as jsonFile:
        json.dump(dmgJson, jsonFile)
    dmgFileName = "%s-%s.dmg" % (bundleName, tagName)
    packCmd = ["appdmg", dmgJsonFileName, dmgFileName]
    check_call(packCmd, cwd=bundleDir)

bundlePath = sys.argv[1]
signEntityName = sys.argv[2]
tags = sys.argv[3:]

prefsJsPath = os.path.join(bundlePath,
    "Contents", "Resources", "defaults", "pref", "distribution.js")
plistPath = os.path.join(bundlePath, "Contents", "Info.plist")
plistDoc = minidom.parse(plistPath)
bundleName = getPlistValue(plistDoc, BUNDLE_NAME_KEY_NAME)
scriptDirPath = os.path.dirname(os.path.abspath(__file__))
dmgJsonTplPath = os.path.join(scriptDirPath, "dmg.json")
dmgJsonTpl = None
with open(dmgJsonTplPath) as jsonFile:
    dmgJsonTpl = json.load(jsonFile)
    def absolutizePath(path):
        return os.path.join(scriptDirPath, path)
    dmgJsonTpl["background"] = absolutizePath(dmgJsonTpl["background"])
    dmgJsonTpl["icon"] = absolutizePath(dmgJsonTpl["icon"])

for tag in tags:
    tagPList(plistDoc, tag)
    # Save document back to file.
    with codecs.open(plistPath, "w", "utf-8") as out:
        plistDoc.writexml(out, encoding="utf-8")
    # Put prefs.js file.
    with open(prefsJsPath, "w") as prefsFile:
        prefsFile.write(DIST_PREF_TPL % tag)
    # Sign and make DMG
    signBundle(bundlePath, signEntityName)
    packBundle(bundlePath, dmgJsonTpl, bundleName, tag)
