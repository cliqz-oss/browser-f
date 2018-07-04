/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=8 sts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef mozilla_dom_ChromeMessageSender_h
#define mozilla_dom_ChromeMessageSender_h

#include "mozilla/dom/MessageSender.h"

namespace mozilla {
namespace dom {

class ChromeMessageBroadcaster;

class ChromeMessageSender final : public MessageSender
{
public:
  ChromeMessageSender(ipc::MessageManagerCallback* aCallback,
                      ChromeMessageBroadcaster* aParentManager,
                      MessageManagerFlags aFlags=MessageManagerFlags::MM_NONE);

  virtual JSObject* WrapObject(JSContext* aCx,
                               JS::Handle<JSObject*> aGivenProto) override;

  // ProcessScriptLoader
  void LoadProcessScript(const nsAString& aUrl, bool aAllowDelayedLoad,
                         mozilla::ErrorResult& aError)
  {
    LoadScript(aUrl, aAllowDelayedLoad, false, aError);
  }
  void RemoveDelayedProcessScript(const nsAString& aURL)
  {
    RemoveDelayedScript(aURL);
  }
  void GetDelayedProcessScripts(JSContext* aCx,
                                nsTArray<nsTArray<JS::Value>>& aScripts,
                                mozilla::ErrorResult& aError)
  {
    GetDelayedScripts(aCx, aScripts, aError);
  }

  // FrameScriptLoader
  void LoadFrameScript(const nsAString& aUrl, bool aAllowDelayedLoad,
                       bool aRunInGlobalScope, mozilla::ErrorResult& aError)
  {
    LoadScript(aUrl, aAllowDelayedLoad, aRunInGlobalScope, aError);
  }
  void RemoveDelayedFrameScript(const nsAString& aURL)
  {
    RemoveDelayedScript(aURL);
  }
  void GetDelayedFrameScripts(JSContext* aCx,
                              nsTArray<nsTArray<JS::Value>>& aScripts,
                              mozilla::ErrorResult& aError)
  {
    GetDelayedScripts(aCx, aScripts, aError);
  }
};

} // namespace dom
} // namespace mozilla

#endif // mozilla_dom_ChromeMessageSender_h
