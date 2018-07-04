/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=8 sts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "ServiceWorkerInfo.h"

#include "ServiceWorkerScriptCache.h"

namespace mozilla {
namespace dom {

using mozilla::ipc::PrincipalInfo;

static_assert(nsIServiceWorkerInfo::STATE_PARSED == static_cast<uint16_t>(ServiceWorkerState::Parsed),
              "ServiceWorkerState enumeration value should match state values from nsIServiceWorkerInfo.");
static_assert(nsIServiceWorkerInfo::STATE_INSTALLING == static_cast<uint16_t>(ServiceWorkerState::Installing),
              "ServiceWorkerState enumeration value should match state values from nsIServiceWorkerInfo.");
static_assert(nsIServiceWorkerInfo::STATE_INSTALLED == static_cast<uint16_t>(ServiceWorkerState::Installed),
              "ServiceWorkerState enumeration value should match state values from nsIServiceWorkerInfo.");
static_assert(nsIServiceWorkerInfo::STATE_ACTIVATING == static_cast<uint16_t>(ServiceWorkerState::Activating),
              "ServiceWorkerState enumeration value should match state values from nsIServiceWorkerInfo.");
static_assert(nsIServiceWorkerInfo::STATE_ACTIVATED == static_cast<uint16_t>(ServiceWorkerState::Activated),
              "ServiceWorkerState enumeration value should match state values from nsIServiceWorkerInfo.");
static_assert(nsIServiceWorkerInfo::STATE_REDUNDANT == static_cast<uint16_t>(ServiceWorkerState::Redundant),
              "ServiceWorkerState enumeration value should match state values from nsIServiceWorkerInfo.");
static_assert(nsIServiceWorkerInfo::STATE_UNKNOWN == static_cast<uint16_t>(ServiceWorkerState::EndGuard_),
              "ServiceWorkerState enumeration value should match state values from nsIServiceWorkerInfo.");

NS_IMPL_ISUPPORTS(ServiceWorkerInfo, nsIServiceWorkerInfo)

NS_IMETHODIMP
ServiceWorkerInfo::GetScriptSpec(nsAString& aScriptSpec)
{
  MOZ_ASSERT(NS_IsMainThread());
  CopyUTF8toUTF16(mDescriptor.ScriptURL(), aScriptSpec);
  return NS_OK;
}

NS_IMETHODIMP
ServiceWorkerInfo::GetCacheName(nsAString& aCacheName)
{
  MOZ_ASSERT(NS_IsMainThread());
  aCacheName = mCacheName;
  return NS_OK;
}

NS_IMETHODIMP
ServiceWorkerInfo::GetState(uint16_t* aState)
{
  MOZ_ASSERT(aState);
  MOZ_ASSERT(NS_IsMainThread());
  *aState = static_cast<uint16_t>(State());
  return NS_OK;
}

NS_IMETHODIMP
ServiceWorkerInfo::GetDebugger(nsIWorkerDebugger** aResult)
{
  if (NS_WARN_IF(!aResult)) {
    return NS_ERROR_FAILURE;
  }

  return mServiceWorkerPrivate->GetDebugger(aResult);
}

NS_IMETHODIMP
ServiceWorkerInfo::GetHandlesFetchEvents(bool* aValue)
{
  MOZ_ASSERT(aValue);
  MOZ_ASSERT(NS_IsMainThread());
  *aValue = HandlesFetch();
  return NS_OK;
}

NS_IMETHODIMP
ServiceWorkerInfo::GetInstalledTime(PRTime* _retval)
{
  MOZ_ASSERT(NS_IsMainThread());
  MOZ_ASSERT(_retval);
  *_retval = mInstalledTime;
  return NS_OK;
}

NS_IMETHODIMP
ServiceWorkerInfo::GetActivatedTime(PRTime* _retval)
{
  MOZ_ASSERT(NS_IsMainThread());
  MOZ_ASSERT(_retval);
  *_retval = mActivatedTime;
  return NS_OK;
}

NS_IMETHODIMP
ServiceWorkerInfo::GetRedundantTime(PRTime* _retval)
{
  MOZ_ASSERT(NS_IsMainThread());
  MOZ_ASSERT(_retval);
  *_retval = mRedundantTime;
  return NS_OK;
}

NS_IMETHODIMP
ServiceWorkerInfo::AttachDebugger()
{
  return mServiceWorkerPrivate->AttachDebugger();
}

NS_IMETHODIMP
ServiceWorkerInfo::DetachDebugger()
{
  return mServiceWorkerPrivate->DetachDebugger();
}

namespace {

class ChangeStateUpdater final : public Runnable
{
public:
  ChangeStateUpdater(const nsTArray<ServiceWorker*>& aInstances,
                     ServiceWorkerState aState)
    : Runnable("dom::ChangeStateUpdater")
    , mState(aState)
  {
    for (size_t i = 0; i < aInstances.Length(); ++i) {
      mInstances.AppendElement(aInstances[i]);
    }
  }

  NS_IMETHOD Run() override
  {
    for (size_t i = 0; i < mInstances.Length(); ++i) {
      mInstances[i]->SetState(mState);
    }
    return NS_OK;
  }

private:
  AutoTArray<RefPtr<ServiceWorker>, 1> mInstances;
  ServiceWorkerState mState;
};

}

void
ServiceWorkerInfo::UpdateState(ServiceWorkerState aState)
{
  MOZ_ASSERT(NS_IsMainThread());
#ifdef DEBUG
  // Any state can directly transition to redundant, but everything else is
  // ordered.
  if (aState != ServiceWorkerState::Redundant) {
    MOZ_ASSERT_IF(State() == ServiceWorkerState::EndGuard_,
                  aState == ServiceWorkerState::Installing);
    MOZ_ASSERT_IF(State() == ServiceWorkerState::Installing,
                  aState == ServiceWorkerState::Installed);
    MOZ_ASSERT_IF(State() == ServiceWorkerState::Installed,
                  aState == ServiceWorkerState::Activating);
    MOZ_ASSERT_IF(State() == ServiceWorkerState::Activating,
                  aState == ServiceWorkerState::Activated);
  }
  // Activated can only go to redundant.
  MOZ_ASSERT_IF(State() == ServiceWorkerState::Activated,
                aState == ServiceWorkerState::Redundant);
#endif
  // Flush any pending functional events to the worker when it transitions to the
  // activated state.
  // TODO: Do we care that these events will race with the propagation of the
  //       state change?
  if (State() != aState) {
    mServiceWorkerPrivate->UpdateState(aState);
  }
  mDescriptor.SetState(aState);
  nsCOMPtr<nsIRunnable> r = new ChangeStateUpdater(mInstances, State());
  MOZ_ALWAYS_SUCCEEDS(NS_DispatchToMainThread(r.forget()));
  if (State() == ServiceWorkerState::Redundant) {
    serviceWorkerScriptCache::PurgeCache(mPrincipal, mCacheName);
  }
}

ServiceWorkerInfo::ServiceWorkerInfo(nsIPrincipal* aPrincipal,
                                     const nsACString& aScope,
                                     const nsACString& aScriptSpec,
                                     const nsAString& aCacheName,
                                     nsLoadFlags aImportsLoadFlags)
  : mPrincipal(aPrincipal)
  , mDescriptor(GetNextID(), aPrincipal, aScope, aScriptSpec,
                ServiceWorkerState::Parsed)
  , mCacheName(aCacheName)
  , mImportsLoadFlags(aImportsLoadFlags)
  , mCreationTime(PR_Now())
  , mCreationTimeStamp(TimeStamp::Now())
  , mInstalledTime(0)
  , mActivatedTime(0)
  , mRedundantTime(0)
  , mServiceWorkerPrivate(new ServiceWorkerPrivate(this))
  , mSkipWaitingFlag(false)
  , mHandlesFetch(Unknown)
{
  MOZ_ASSERT(mPrincipal);
  // cache origin attributes so we can use them off main thread
  mOriginAttributes = mPrincipal->OriginAttributesRef();
  MOZ_ASSERT(!mDescriptor.ScriptURL().IsEmpty());
  MOZ_ASSERT(!mCacheName.IsEmpty());

  // Scripts of a service worker should always be loaded bypass service workers.
  // Otherwise, we might not be able to update a service worker correctly, if
  // there is a service worker generating the script.
  MOZ_DIAGNOSTIC_ASSERT(mImportsLoadFlags & nsIChannel::LOAD_BYPASS_SERVICE_WORKER);
}

ServiceWorkerInfo::~ServiceWorkerInfo()
{
  MOZ_ASSERT(mServiceWorkerPrivate);
  mServiceWorkerPrivate->NoteDeadServiceWorkerInfo();
}

static uint64_t gServiceWorkerInfoCurrentID = 0;

uint64_t
ServiceWorkerInfo::GetNextID() const
{
  return ++gServiceWorkerInfoCurrentID;
}

void
ServiceWorkerInfo::AddServiceWorker(ServiceWorker* aWorker)
{
  MOZ_DIAGNOSTIC_ASSERT(aWorker);
#ifdef MOZ_DIAGNOSTIC_ASSERT_ENABLED
  nsAutoString workerURL;
  aWorker->GetScriptURL(workerURL);
  MOZ_DIAGNOSTIC_ASSERT(
    workerURL.Equals(NS_ConvertUTF8toUTF16(mDescriptor.ScriptURL())));
#endif
  MOZ_ASSERT(!mInstances.Contains(aWorker));

  mInstances.AppendElement(aWorker);
  aWorker->SetState(State());
}

void
ServiceWorkerInfo::RemoveServiceWorker(ServiceWorker* aWorker)
{
  MOZ_DIAGNOSTIC_ASSERT(aWorker);
#ifdef MOZ_DIAGNOSTIC_ASSERT_ENABLED
  nsAutoString workerURL;
  aWorker->GetScriptURL(workerURL);
  MOZ_DIAGNOSTIC_ASSERT(
    workerURL.Equals(NS_ConvertUTF8toUTF16(mDescriptor.ScriptURL())));
#endif

  DebugOnly<bool> removed = mInstances.RemoveElement(aWorker);
  MOZ_ASSERT(removed);
}

void
ServiceWorkerInfo::PostMessage(nsIGlobalObject* aGlobal,
                               JSContext* aCx, JS::Handle<JS::Value> aMessage,
                               const Sequence<JSObject*>& aTransferable,
                               ErrorResult& aRv)
{
  MOZ_ASSERT(NS_IsMainThread());

  nsCOMPtr<nsPIDOMWindowInner> window = do_QueryInterface(aGlobal);
  if (NS_WARN_IF(!window || !window->GetExtantDoc())) {
    aRv.Throw(NS_ERROR_DOM_INVALID_STATE_ERR);
    return;
  }

  auto storageAllowed = nsContentUtils::StorageAllowedForWindow(window);
  if (storageAllowed != nsContentUtils::StorageAccess::eAllow) {
    ServiceWorkerManager::LocalizeAndReportToAllClients(
      Scope(), "ServiceWorkerPostMessageStorageError",
      nsTArray<nsString> { NS_ConvertUTF8toUTF16(Scope()) });
    aRv.Throw(NS_ERROR_DOM_SECURITY_ERR);
    return;
  }

  Maybe<ClientInfo> clientInfo = window->GetClientInfo();
  Maybe<ClientState> clientState = window->GetClientState();
  if (NS_WARN_IF(clientInfo.isNothing() || clientState.isNothing())) {
    aRv.Throw(NS_ERROR_DOM_INVALID_STATE_ERR);
    return;
  }

  aRv = mServiceWorkerPrivate->SendMessageEvent(aCx, aMessage, aTransferable,
                                                ClientInfoAndState(clientInfo.ref().ToIPC(),
                                                                   clientState.ref().ToIPC()));
}

void
ServiceWorkerInfo::UpdateInstalledTime()
{
  MOZ_ASSERT(State() == ServiceWorkerState::Installed);
  MOZ_ASSERT(mInstalledTime == 0);

  mInstalledTime =
    mCreationTime + static_cast<PRTime>((TimeStamp::Now() -
                                         mCreationTimeStamp).ToMicroseconds());
}

void
ServiceWorkerInfo::UpdateActivatedTime()
{
  MOZ_ASSERT(State() == ServiceWorkerState::Activated);
  MOZ_ASSERT(mActivatedTime == 0);

  mActivatedTime =
    mCreationTime + static_cast<PRTime>((TimeStamp::Now() -
                                         mCreationTimeStamp).ToMicroseconds());
}

void
ServiceWorkerInfo::UpdateRedundantTime()
{
  MOZ_ASSERT(State() == ServiceWorkerState::Redundant);
  MOZ_ASSERT(mRedundantTime == 0);

  mRedundantTime =
    mCreationTime + static_cast<PRTime>((TimeStamp::Now() -
                                         mCreationTimeStamp).ToMicroseconds());
}

} // namespace dom
} // namespace mozilla
