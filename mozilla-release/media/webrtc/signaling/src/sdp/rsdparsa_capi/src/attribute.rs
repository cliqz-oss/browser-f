use std::slice;
use libc::{size_t, uint8_t, uint16_t, uint32_t, int64_t};

use rsdparsa::SdpSession;
use rsdparsa::attribute_type::{SdpAttribute, SdpAttributeType, SdpAttributePayloadType,
                               SdpAttributeFingerprint, SdpAttributeSetup, SdpAttributeSsrc,
                               SdpAttributeRtpmap, SdpAttributeFmtpParameters,
                               SdpAttributeMsid, SdpAttributeMsidSemantic,
                               SdpAttributeGroupSemantic, SdpAttributeGroup, SdpAttributeRtcp,
                               SdpAttributeRtcpFb, SdpAttributeSctpmap,
                               SdpAttributeRemoteCandidate, SdpAttributeExtmap,
                               SdpAttributeDirection};
use nserror::{nsresult, NS_OK, NS_ERROR_INVALID_ARG};

use types::StringView;
use network::RustIpAddr;


#[repr(C)]
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum RustSdpAttributeType {
    BundleOnly,
    Candidate,
    EndOfCandidates,
    Extmap,
    Fingerprint,
    Fmtp,
    Group,
    IceLite,
    IceMismatch,
    IceOptions,
    IcePwd,
    IceUfrag,
    Identity,
    ImageAttr,
    Inactive,
    Label,
    MaxMessageSize,
    MaxPtime,
    Mid,
    Msid,
    MsidSemantic,
    Ptime,
    Rid,
    Recvonly,
    RemoteCandidate,
    Rtpmap,
    Rtcp,
    Rtcpfb,
    RtcpMux,
    RtcpRsize,
    Sctpmap,
    SctpPort,
    Sendonly,
    Sendrecv,
    Setup,
    Simulcast,
    Ssrc,
    SsrcGroup,
}

impl<'a> From<&'a SdpAttribute> for RustSdpAttributeType {
    fn from(other: &SdpAttribute) -> Self {
        match *other {
            SdpAttribute::BundleOnly{..} => RustSdpAttributeType::BundleOnly,
            SdpAttribute::Candidate{..} => RustSdpAttributeType::Candidate,
            SdpAttribute::EndOfCandidates{..} => RustSdpAttributeType::EndOfCandidates,
            SdpAttribute::Extmap{..} => RustSdpAttributeType::Extmap,
            SdpAttribute::Fingerprint{..} => RustSdpAttributeType::Fingerprint,
            SdpAttribute::Fmtp{..} => RustSdpAttributeType::Fmtp,
            SdpAttribute::Group{..} => RustSdpAttributeType::Group,
            SdpAttribute::IceLite{..} => RustSdpAttributeType::IceLite,
            SdpAttribute::IceMismatch{..} => RustSdpAttributeType::IceMismatch,
            SdpAttribute::IceOptions{..} => RustSdpAttributeType::IceOptions,
            SdpAttribute::IcePwd{..} => RustSdpAttributeType::IcePwd,
            SdpAttribute::IceUfrag{..} => RustSdpAttributeType::IceUfrag,
            SdpAttribute::Identity{..} => RustSdpAttributeType::Identity,
            SdpAttribute::ImageAttr{..} => RustSdpAttributeType::ImageAttr,
            SdpAttribute::Inactive{..} => RustSdpAttributeType::Inactive,
            SdpAttribute::Label{..} => RustSdpAttributeType::Label,
            SdpAttribute::MaxMessageSize{..} => RustSdpAttributeType::MaxMessageSize,
            SdpAttribute::MaxPtime{..} => RustSdpAttributeType::MaxPtime,
            SdpAttribute::Mid{..} => RustSdpAttributeType::Mid,
            SdpAttribute::Msid{..} => RustSdpAttributeType::Msid,
            SdpAttribute::MsidSemantic{..} => RustSdpAttributeType::MsidSemantic,
            SdpAttribute::Ptime{..} => RustSdpAttributeType::Ptime,
            SdpAttribute::Rid{..} => RustSdpAttributeType::Rid,
            SdpAttribute::Recvonly{..} => RustSdpAttributeType::Recvonly,
            SdpAttribute::RemoteCandidate{..} => RustSdpAttributeType::RemoteCandidate,
            SdpAttribute::Rtcp{..} => RustSdpAttributeType::Rtcp,
            SdpAttribute::Rtcpfb{..} => RustSdpAttributeType::Rtcpfb,
            SdpAttribute::RtcpMux{..} => RustSdpAttributeType::RtcpMux,
            SdpAttribute::RtcpRsize{..} => RustSdpAttributeType::RtcpRsize,
            SdpAttribute::Rtpmap{..} => RustSdpAttributeType::Rtpmap,
            SdpAttribute::Sctpmap{..} => RustSdpAttributeType::Sctpmap,
            SdpAttribute::SctpPort{..} => RustSdpAttributeType::SctpPort,
            SdpAttribute::Sendonly{..} => RustSdpAttributeType::Sendonly,
            SdpAttribute::Sendrecv{..} => RustSdpAttributeType::Sendrecv,
            SdpAttribute::Setup{..} => RustSdpAttributeType::Setup,
            SdpAttribute::Simulcast{..} => RustSdpAttributeType::Simulcast,
            SdpAttribute::Ssrc{..} => RustSdpAttributeType::Ssrc,
            SdpAttribute::SsrcGroup{..} => RustSdpAttributeType::SsrcGroup
        }
    }
}

#[no_mangle]
pub unsafe extern "C" fn num_attributes(session: *const SdpSession) -> u32 {
    (*session).attribute.len() as u32
}

#[no_mangle]
pub unsafe extern "C" fn get_attribute_ptr(session: *const SdpSession,
                                           index: u32,
                                           ret: *mut *const SdpAttribute) -> nsresult {
    match (*session).attribute.get(index as usize) {
        Some(attribute) => {
            *ret = attribute as *const SdpAttribute;
            NS_OK
        },
        None => NS_ERROR_INVALID_ARG
    }
}

fn count_attribute(attributes: &[SdpAttribute], search: RustSdpAttributeType) -> usize {
    let mut count = 0;
    for attribute in (*attributes).iter() {
        if RustSdpAttributeType::from(attribute) == search {
            count += 1;
        }
    }
    count
}

fn argsearch(attributes: &[SdpAttribute], attribute_type: RustSdpAttributeType) -> Option<usize> {
    for (i, attribute) in (*attributes).iter().enumerate() {
        if RustSdpAttributeType::from(attribute) == attribute_type {
            return Some(i);
        }
    }
    None
}

pub unsafe fn has_attribute(attributes: *const Vec<SdpAttribute>, attribute_type: RustSdpAttributeType) -> bool {
    argsearch((*attributes).as_slice(), attribute_type).is_some()
}

fn get_attribute(attributes: &[SdpAttribute], attribute_type: RustSdpAttributeType) -> Option<&SdpAttribute> {
    argsearch(attributes, attribute_type).map(|i| &attributes[i])
}

#[no_mangle]
pub unsafe extern "C" fn sdp_get_iceufrag(attributes: *const Vec<SdpAttribute>, ret: *mut StringView) -> nsresult {
    let attr = get_attribute((*attributes).as_slice(), RustSdpAttributeType::IceUfrag);
    if let Some(&SdpAttribute::IceUfrag(ref string)) = attr {
        *ret = StringView::from(string.as_str());
        return NS_OK;
    }
    NS_ERROR_INVALID_ARG
}

#[no_mangle]
pub unsafe extern "C" fn sdp_get_icepwd(attributes: *const Vec<SdpAttribute>, ret: *mut StringView) -> nsresult {
    let attr = get_attribute((*attributes).as_slice(), RustSdpAttributeType::IcePwd);
    if let Some(&SdpAttribute::IcePwd(ref string)) = attr {
        *ret = StringView::from(string.as_str());
        return NS_OK;
    }
    NS_ERROR_INVALID_ARG
}

#[no_mangle]
pub unsafe extern "C" fn sdp_get_identity(attributes: *const Vec<SdpAttribute>, ret: *mut StringView) -> nsresult {
    let attr = get_attribute((*attributes).as_slice(), RustSdpAttributeType::Identity);
    if let Some(&SdpAttribute::Identity(ref string)) = attr {
        *ret = StringView::from(string.as_str());
        return NS_OK;
    }
    NS_ERROR_INVALID_ARG
}

#[no_mangle]
pub unsafe extern "C" fn sdp_get_iceoptions(attributes: *const Vec<SdpAttribute>, ret: *mut *const Vec<String>) -> nsresult {
    let attr = get_attribute((*attributes).as_slice(), RustSdpAttributeType::IceOptions);
    if let Some(&SdpAttribute::IceOptions(ref options)) = attr {
        *ret = options;
        return NS_OK;
    }
    NS_ERROR_INVALID_ARG
}

#[repr(C)]
#[derive(Clone, Copy)]
pub struct RustSdpAttributeFingerprint {
    hash_algorithm: StringView,
    fingerprint: StringView
}

impl<'a> From<&'a SdpAttributeFingerprint> for RustSdpAttributeFingerprint {
    fn from(other: &SdpAttributeFingerprint) -> Self {
        RustSdpAttributeFingerprint {
            hash_algorithm: StringView::from(other.hash_algorithm.as_str()),
            fingerprint: StringView::from(other.fingerprint.as_str())
        }
    }
}




#[no_mangle]
pub unsafe extern "C" fn sdp_get_fingerprint_count(attributes: *const Vec<SdpAttribute>) -> size_t {
    count_attribute((*attributes).as_slice(), RustSdpAttributeType::Fingerprint)
}

#[no_mangle]
pub unsafe extern "C" fn sdp_get_fingerprints(attributes: *const Vec<SdpAttribute>, ret_size: size_t, ret_fingerprints: *mut RustSdpAttributeFingerprint) {
    let attrs: Vec<_> = (*attributes).iter().filter_map(|x| if let SdpAttribute::Fingerprint(ref data) = *x {
        Some(RustSdpAttributeFingerprint::from(data))
    } else {
        None
    }).collect();
    let fingerprints = slice::from_raw_parts_mut(ret_fingerprints, ret_size);
    fingerprints.copy_from_slice(attrs.as_slice());
}

#[repr(C)]
#[derive(Clone)]
pub enum RustSdpAttributeSetup {
    Active,
    Actpass,
    Holdconn,
    Passive,
}

impl<'a> From<&'a SdpAttributeSetup> for RustSdpAttributeSetup {
    fn from(other: &SdpAttributeSetup) -> Self {
        match *other {
            SdpAttributeSetup::Active => RustSdpAttributeSetup::Active,
            SdpAttributeSetup::Actpass => RustSdpAttributeSetup::Actpass,
            SdpAttributeSetup::Holdconn => RustSdpAttributeSetup::Holdconn,
            SdpAttributeSetup::Passive => RustSdpAttributeSetup::Passive
        }
    }
}

#[no_mangle]
pub unsafe extern "C" fn sdp_get_setup(attributes: *const Vec<SdpAttribute>, ret: *mut RustSdpAttributeSetup) -> nsresult {
    let attr = get_attribute((*attributes).as_slice(), RustSdpAttributeType::Setup);
    if let Some(&SdpAttribute::Setup(ref setup)) = attr {
        *ret = RustSdpAttributeSetup::from(setup);
        return NS_OK;
    }
    NS_ERROR_INVALID_ARG
}

#[repr(C)]
#[derive(Clone, Copy)]
pub struct RustSdpAttributeSsrc {
    pub id: uint32_t,
    pub attribute: StringView,
    pub value: StringView,
}

impl<'a> From<&'a SdpAttributeSsrc> for RustSdpAttributeSsrc {
    fn from(other: &SdpAttributeSsrc) -> Self {
        RustSdpAttributeSsrc {
            id: other.id,
            attribute: StringView::from(&other.attribute),
            value: StringView::from(&other.value)
        }
    }
}

#[no_mangle]
pub unsafe extern "C" fn sdp_get_ssrc_count(attributes: *const Vec<SdpAttribute>) -> size_t {
    count_attribute((*attributes).as_slice(), RustSdpAttributeType::Ssrc)
}

#[no_mangle]
pub unsafe extern "C" fn sdp_get_ssrcs(attributes: *const Vec<SdpAttribute>, ret_size: size_t, ret_ssrcs: *mut RustSdpAttributeSsrc) {
    let attrs: Vec<_> = (*attributes).iter().filter_map(|x| if let SdpAttribute::Ssrc(ref data) = *x {
        Some(RustSdpAttributeSsrc::from(data))
    } else {
        None
    }).collect();
    let ssrcs = slice::from_raw_parts_mut(ret_ssrcs, ret_size);
    ssrcs.copy_from_slice(attrs.as_slice());
}

#[repr(C)]
#[derive(Clone, Copy)]
pub struct RustSdpAttributeRtpmap {
    pub payload_type: uint8_t,
    pub codec_name: StringView,
    pub frequency: uint32_t,
    pub channels: uint32_t,
}

impl<'a> From<&'a SdpAttributeRtpmap> for RustSdpAttributeRtpmap {
    fn from(other: &SdpAttributeRtpmap) -> Self {
        RustSdpAttributeRtpmap {
            payload_type: other.payload_type as uint8_t,
            codec_name: StringView::from(other.codec_name.as_str()),
            frequency: other.frequency as uint32_t,
            channels: other.channels.unwrap_or(1)
        }
    }
}

#[no_mangle]
pub unsafe extern "C" fn sdp_get_rtpmap_count(attributes: *const Vec<SdpAttribute>) -> size_t {
    count_attribute((*attributes).as_slice(), RustSdpAttributeType::Rtpmap)
}

#[no_mangle]
pub unsafe extern "C" fn sdp_get_rtpmaps(attributes: *const Vec<SdpAttribute>, ret_size: size_t, ret_rtpmaps: *mut RustSdpAttributeRtpmap) {
    let attrs: Vec<_> = (*attributes).iter().filter_map(|x| if let SdpAttribute::Rtpmap(ref data) = *x {
        Some(RustSdpAttributeRtpmap::from(data))
    } else {
        None
    }).collect();
    let rtpmaps = slice::from_raw_parts_mut(ret_rtpmaps, ret_size);
    rtpmaps.copy_from_slice(attrs.as_slice());
}

#[repr(C)]
#[derive(Clone, Copy)]
pub struct RustSdpAttributeFmtpParameters {

    // H264
    pub packetization_mode: uint32_t,
    pub level_asymmetry_allowed: bool,
    pub profile_level_id: uint32_t,
    pub max_fs: uint32_t,
    pub max_cpb: uint32_t,
    pub max_dpb: uint32_t,
    pub max_br: uint32_t,
    pub max_mbps: uint32_t,

    // VP8 and VP9
    // max_fs, already defined in H264
    pub max_fr: uint32_t,

    // Opus
    pub maxplaybackrate: uint32_t,
    pub usedtx: bool,
    pub stereo: bool,
    pub useinbandfec: bool,
    pub cbr: bool,

    // telephone-event
    pub dtmf_tones: StringView,

    // Red
    pub encodings: *const Vec<uint8_t>,

    // Unknown
    pub unknown_tokens: *const Vec<String>,
}

impl<'a> From<&'a SdpAttributeFmtpParameters> for RustSdpAttributeFmtpParameters {
    fn from(other: &SdpAttributeFmtpParameters) -> Self {
        RustSdpAttributeFmtpParameters{
                packetization_mode: other.packetization_mode,
                level_asymmetry_allowed: other.level_asymmetry_allowed,
                profile_level_id: other.profile_level_id,
                max_fs: other.max_fs,
                max_cpb: other.max_cpb,
                max_dpb: other.max_dpb,
                max_br: other.max_br,
                max_mbps: other.max_mbps,
                usedtx: other.usedtx,
                stereo: other.stereo,
                useinbandfec: other.useinbandfec,
                cbr: other.cbr,
                max_fr: other.max_fr,
                maxplaybackrate: other.maxplaybackrate,
                dtmf_tones: StringView::from(other.dtmf_tones.as_str()),
                encodings: &other.encodings,
                unknown_tokens: &other.unknown_tokens,
        }
    }
}

#[repr(C)]
#[derive(Clone, Copy)]
pub struct RustSdpAttributeFmtp {
    pub payload_type: uint8_t,
    pub codec_name: StringView,
    pub parameters: RustSdpAttributeFmtpParameters,
}

#[no_mangle]
pub unsafe extern "C" fn sdp_get_fmtp_count(attributes: *const Vec<SdpAttribute>) -> size_t {
    count_attribute((*attributes).as_slice(), RustSdpAttributeType::Fmtp)
}

fn find_payload_type(attributes: &[SdpAttribute], payload_type: u8) -> Option<&SdpAttributeRtpmap> {
    attributes.iter().filter_map(|x| if let SdpAttribute::Rtpmap(ref data) = *x {
        if data.payload_type == payload_type {
            Some(data)
        } else {
            None
        }
    } else {
        None
    }).next()
}

#[no_mangle]
pub unsafe extern "C" fn sdp_get_fmtp(attributes: *const Vec<SdpAttribute>, ret_size: size_t,
                                                ret_fmtp: *mut RustSdpAttributeFmtp) -> size_t {
    let fmtps = (*attributes).iter().filter_map(|x| if let SdpAttribute::Fmtp(ref data) = *x {
        Some(data)
    } else {
        None
    });
    let mut rust_fmtps = Vec::new();
    for fmtp in fmtps {
        if let Some(rtpmap) = find_payload_type((*attributes).as_slice(), fmtp.payload_type) {
            rust_fmtps.push( RustSdpAttributeFmtp{
                payload_type: fmtp.payload_type as u8,
                codec_name: StringView::from(rtpmap.codec_name.as_str()),
                parameters: RustSdpAttributeFmtpParameters::from(&fmtp.parameters),
                }
            );
        }
    }
    let fmtps = if ret_size <= rust_fmtps.len() {
        slice::from_raw_parts_mut(ret_fmtp, ret_size)
    } else {
        slice::from_raw_parts_mut(ret_fmtp, rust_fmtps.len())
    };
    fmtps.copy_from_slice(rust_fmtps.as_slice());
    fmtps.len()
}

#[no_mangle]
pub unsafe extern "C" fn sdp_get_ptime(attributes: *const Vec<SdpAttribute>) -> int64_t {
    for attribute in (*attributes).iter() {
        if let SdpAttribute::Ptime(time) = *attribute {
            return time as int64_t;
        }
    }
    -1
}

#[repr(C)]
#[derive(Clone, Copy)]
pub struct RustSdpAttributeFlags {
    pub ice_lite: bool,
    pub rtcp_mux: bool,
    pub bundle_only: bool,
    pub end_of_candidates: bool
}


#[no_mangle]
pub unsafe extern "C" fn sdp_get_attribute_flags(attributes: *const Vec<SdpAttribute>) -> RustSdpAttributeFlags {
    let mut ret = RustSdpAttributeFlags {
        ice_lite: false,
        rtcp_mux: false,
        bundle_only: false,
        end_of_candidates: false
    };
    for attribute in (*attributes).iter() {
        if let SdpAttribute::IceLite = *attribute {
            ret.ice_lite = true;
        } else if let SdpAttribute::RtcpMux = *attribute {
            ret.rtcp_mux = true;
        } else if let SdpAttribute::BundleOnly = *attribute {
            ret.bundle_only = true;
        } else if let SdpAttribute::EndOfCandidates = *attribute {
            ret.end_of_candidates = true;
        }
    }
    ret
}

#[no_mangle]
pub unsafe extern "C" fn sdp_get_mid(attributes: *const Vec<SdpAttribute>, ret: *mut StringView) -> nsresult {
    for attribute in (*attributes).iter(){
        if let SdpAttribute::Mid(ref data) = *attribute {
            *ret = StringView::from(data.as_str());
            return NS_OK;
        }
    }
    NS_ERROR_INVALID_ARG
}

#[repr(C)]
#[derive(Clone, Copy)]
pub struct RustSdpAttributeMsid {
    id: StringView,
    appdata: StringView
}

impl<'a> From<&'a SdpAttributeMsid> for RustSdpAttributeMsid {
    fn from(other: &SdpAttributeMsid) -> Self {
        RustSdpAttributeMsid {
            id: StringView::from(other.id.as_str()),
            appdata: StringView::from(&other.appdata)
        }
    }
}

#[no_mangle]
pub unsafe extern "C" fn sdp_get_msid_count(attributes: *const Vec<SdpAttribute>) -> size_t {
    count_attribute((*attributes).as_slice(), RustSdpAttributeType::Msid)
}

#[no_mangle]
pub unsafe extern "C" fn sdp_get_msids(attributes: *const Vec<SdpAttribute>, ret_size: size_t, ret_msids: *mut RustSdpAttributeMsid) {
    let attrs: Vec<_> = (*attributes).iter().filter_map(|x| if let SdpAttribute::Msid(ref data) = *x {
        Some(RustSdpAttributeMsid::from(data))
    } else {
        None
    }).collect();
    let msids = slice::from_raw_parts_mut(ret_msids, ret_size);
    msids.copy_from_slice(attrs.as_slice());
}

// TODO: Finish msid attributes once parsing is changed upstream.
#[repr(C)]
#[derive(Clone, Copy)]
pub struct RustSdpAttributeMsidSemantic {
    pub semantic: StringView,
    pub msids: *const Vec<String>
}

impl<'a> From<&'a SdpAttributeMsidSemantic> for RustSdpAttributeMsidSemantic {
    fn from(other: &SdpAttributeMsidSemantic) -> Self {
        RustSdpAttributeMsidSemantic {
            semantic: StringView::from(other.semantic.as_str()),
            msids: &other.msids
        }
    }
}

#[no_mangle]
pub unsafe extern "C" fn sdp_get_msid_semantic_count(attributes: *const Vec<SdpAttribute>) -> size_t {
    count_attribute((*attributes).as_slice(), RustSdpAttributeType::MsidSemantic)
}

#[no_mangle]
pub unsafe extern "C" fn sdp_get_msid_semantics(attributes: *const Vec<SdpAttribute>, ret_size: size_t, ret_msid_semantics: *mut RustSdpAttributeMsidSemantic) {
    let attrs: Vec<_> = (*attributes).iter().filter_map(|x| if let SdpAttribute::MsidSemantic(ref data) = *x {
        Some(RustSdpAttributeMsidSemantic::from(data))
    } else {
        None
    }).collect();
    let msid_semantics = slice::from_raw_parts_mut(ret_msid_semantics, ret_size);
    msid_semantics.copy_from_slice(attrs.as_slice());
}

#[repr(C)]
#[derive(Clone, Copy)]
pub enum RustSdpAttributeGroupSemantic {
    LipSynchronization,
    FlowIdentification,
    SingleReservationFlow,
    AlternateNetworkAddressType,
    ForwardErrorCorrection,
    DecodingDependency,
    Bundle,
}

impl<'a> From<&'a SdpAttributeGroupSemantic> for RustSdpAttributeGroupSemantic {
    fn from(other: &SdpAttributeGroupSemantic) -> Self {
        match *other {
            SdpAttributeGroupSemantic::LipSynchronization => RustSdpAttributeGroupSemantic::LipSynchronization,
            SdpAttributeGroupSemantic::FlowIdentification => RustSdpAttributeGroupSemantic::FlowIdentification,
            SdpAttributeGroupSemantic::SingleReservationFlow => RustSdpAttributeGroupSemantic::SingleReservationFlow,
            SdpAttributeGroupSemantic::AlternateNetworkAddressType => RustSdpAttributeGroupSemantic::AlternateNetworkAddressType,
            SdpAttributeGroupSemantic::ForwardErrorCorrection => RustSdpAttributeGroupSemantic::ForwardErrorCorrection,
            SdpAttributeGroupSemantic::DecodingDependency => RustSdpAttributeGroupSemantic::DecodingDependency,
            SdpAttributeGroupSemantic::Bundle => RustSdpAttributeGroupSemantic::Bundle
        }
    }
}


#[repr(C)]
#[derive(Clone, Copy)]
pub struct RustSdpAttributeGroup {
    pub semantic: RustSdpAttributeGroupSemantic,
    pub tags: *const Vec<String>
}

impl<'a> From<&'a SdpAttributeGroup> for RustSdpAttributeGroup {
    fn from(other: &SdpAttributeGroup) -> Self {
        RustSdpAttributeGroup {
            semantic: RustSdpAttributeGroupSemantic::from(&other.semantics),
            tags: &other.tags
        }
    }
}

#[no_mangle]
pub unsafe extern "C" fn sdp_get_group_count(attributes: *const Vec<SdpAttribute>) -> size_t {
    count_attribute((*attributes).as_slice(), RustSdpAttributeType::Group)
}

#[no_mangle]
pub unsafe extern "C" fn sdp_get_groups(attributes: *const Vec<SdpAttribute>, ret_size: size_t, ret_groups: *mut RustSdpAttributeGroup) {
    let attrs: Vec<_> = (*attributes).iter().filter_map(|x| if let SdpAttribute::Group(ref data) = *x {
        Some(RustSdpAttributeGroup::from(data))
    } else {
        None
    }).collect();
    let groups = slice::from_raw_parts_mut(ret_groups, ret_size);
    groups.copy_from_slice(attrs.as_slice());
}

#[repr(C)]
pub struct RustSdpAttributeRtcp {
    pub port: uint32_t,
    pub unicast_addr: RustIpAddr,
}

impl<'a> From<&'a SdpAttributeRtcp> for RustSdpAttributeRtcp {
    fn from(other: &SdpAttributeRtcp) -> Self {
        RustSdpAttributeRtcp {
            port: other.port as u32,
            unicast_addr: RustIpAddr::from(&other.unicast_addr)
        }
    }
}

#[no_mangle]
pub unsafe extern "C" fn sdp_get_rtcp(attributes: *const Vec<SdpAttribute>, ret: *mut RustSdpAttributeRtcp) -> nsresult {
    let attr = get_attribute((*attributes).as_slice(), RustSdpAttributeType::Rtcp);
    if let Some(&SdpAttribute::Rtcp(ref data)) = attr {
        *ret = RustSdpAttributeRtcp::from(data);
        return NS_OK;
    }
    NS_ERROR_INVALID_ARG
}


#[repr(C)]
#[derive(Clone, Copy)]
pub struct RustSdpAttributeRtcpFb {
    pub payload_type: u32,
    pub feedback_type: u32,
    pub parameter: StringView,
    pub extra: StringView
}

impl<'a> From<&'a SdpAttributeRtcpFb> for RustSdpAttributeRtcpFb {
    fn from(other: &SdpAttributeRtcpFb) -> Self {
        RustSdpAttributeRtcpFb {
            payload_type: match other.payload_type{
                SdpAttributePayloadType::Wildcard => u32::max_value(),
                SdpAttributePayloadType::PayloadType(x) => x as u32,
            },
            feedback_type: other.feedback_type.clone() as u32,
            parameter: StringView::from(other.parameter.as_str()),
            extra: StringView::from(other.extra.as_str()),
        }
    }
}

#[no_mangle]
pub unsafe extern "C" fn sdp_get_rtcpfb_count(attributes: *const Vec<SdpAttribute>) -> size_t {
    count_attribute((*attributes).as_slice(), RustSdpAttributeType::Rtcpfb)
}

#[no_mangle]
pub unsafe extern "C" fn sdp_get_rtcpfbs(attributes: *const Vec<SdpAttribute>, ret_size: size_t, ret_rtcpfbs: *mut RustSdpAttributeRtcpFb) {
    let attrs: Vec<_> = (*attributes).iter().filter_map(|x| if let SdpAttribute::Rtcpfb(ref data) = *x {
        Some(RustSdpAttributeRtcpFb::from(data))
    } else {
        None
    }).collect();
    let rtcpfbs = slice::from_raw_parts_mut(ret_rtcpfbs, ret_size);
    rtcpfbs.clone_from_slice(attrs.as_slice());
}


#[no_mangle]
pub unsafe extern "C" fn sdp_get_imageattr_count(attributes: *const Vec<SdpAttribute>) -> size_t {
    count_attribute((*attributes).as_slice(), RustSdpAttributeType::ImageAttr)
}

#[no_mangle]
pub unsafe extern "C" fn sdp_get_imageattrs(attributes: *const Vec<SdpAttribute>, ret_size: size_t, ret_groups: *mut StringView) {
    let attrs: Vec<_> = (*attributes).iter().filter_map(|x| if let SdpAttribute::ImageAttr(ref string) = *x {
        Some(StringView::from(string.as_str()))
    } else {
        None
    }).collect();
    let imageattrs = slice::from_raw_parts_mut(ret_groups, ret_size);
    imageattrs.copy_from_slice(attrs.as_slice());
}

#[repr(C)]
#[derive(Clone, Copy)]
pub struct RustSdpAttributeSctpmap {
    pub port: uint32_t,
    pub channels: uint32_t,
}

impl<'a> From<&'a SdpAttributeSctpmap> for RustSdpAttributeSctpmap {
    fn from(other: &SdpAttributeSctpmap) -> Self {
        RustSdpAttributeSctpmap {
            port: other.port as u32,
            channels: other.channels
        }
    }
}

#[no_mangle]
pub unsafe extern "C" fn sdp_get_sctpmap_count(attributes: *const Vec<SdpAttribute>) -> size_t {
    count_attribute((*attributes).as_slice(), RustSdpAttributeType::Sctpmap)
}

#[no_mangle]
pub unsafe extern "C" fn sdp_get_sctpmaps(attributes: *const Vec<SdpAttribute>, ret_size: size_t, ret_sctpmaps: *mut RustSdpAttributeSctpmap) {
    let attrs: Vec<_> = (*attributes).iter().filter_map(|x| if let SdpAttribute::Sctpmap(ref data) = *x {
        Some(RustSdpAttributeSctpmap::from(data))
    } else {
        None
    }).collect();
    let sctpmaps = slice::from_raw_parts_mut(ret_sctpmaps, ret_size);
    sctpmaps.copy_from_slice(attrs.as_slice());
}

#[repr(C)]
#[derive(Clone, Copy)]
pub enum RustDirection {
    Recvonly,
    Sendonly,
    Sendrecv,
    Inactive
}

impl<'a> From<&'a Option<SdpAttributeDirection>> for RustDirection {
    fn from(other: &Option<SdpAttributeDirection>) -> Self {
        match *other {
            Some(ref direction) => {
                match *direction {
                    SdpAttributeDirection::Recvonly => RustDirection::Recvonly,
                    SdpAttributeDirection::Sendonly => RustDirection::Sendonly,
                    SdpAttributeDirection::Sendrecv => RustDirection::Sendrecv
                }
            },
            None => RustDirection::Inactive
        }
    }
}

#[no_mangle]
pub unsafe extern "C" fn sdp_get_direction(attributes: *const Vec<SdpAttribute>) -> RustDirection {
    for attribute in (*attributes).iter() {
        match *attribute {
            SdpAttribute::Recvonly => {
                return RustDirection::Recvonly;
            },
            SdpAttribute::Sendonly => {
                return RustDirection::Sendonly;
            },
            SdpAttribute::Sendrecv => {
                return RustDirection::Sendrecv;
            },
            SdpAttribute::Inactive => {
                return RustDirection::Inactive;
            },
            _ => ()
        }
    }
    RustDirection::Sendrecv
}

#[repr(C)]
pub struct RustSdpAttributeRemoteCandidate {
    pub component: uint32_t,
    pub address: RustIpAddr,
    pub port: uint32_t,
}


impl<'a> From<&'a SdpAttributeRemoteCandidate> for RustSdpAttributeRemoteCandidate {
    fn from(other: &SdpAttributeRemoteCandidate) -> Self {
        RustSdpAttributeRemoteCandidate {
            component: other.component,
            address: RustIpAddr::from(&other.address),
            port: other.port
        }
    }
}

#[no_mangle]
pub unsafe extern "C" fn sdp_get_remote_candidate_count(attributes: *const Vec<SdpAttribute>) -> size_t {
    count_attribute((*attributes).as_slice(), RustSdpAttributeType::RemoteCandidate)
}

#[no_mangle]
pub unsafe extern "C" fn sdp_get_remote_candidates(attributes: *const Vec<SdpAttribute>, ret_size: size_t, ret_candidates: *mut RustSdpAttributeRemoteCandidate) {
    let attrs  = (*attributes).iter().filter_map(|x| if let SdpAttribute::RemoteCandidate(ref data) = *x {
        Some(RustSdpAttributeRemoteCandidate::from(data))
    } else {
        None
    });
    let candidates = slice::from_raw_parts_mut(ret_candidates, ret_size);
    for (source, destination) in attrs.zip(candidates) {
        *destination = source
    }
}

#[no_mangle]
pub unsafe extern "C" fn sdp_get_rid_count(attributes: *const Vec<SdpAttribute>) -> size_t {
    count_attribute((*attributes).as_slice(), RustSdpAttributeType::Rid)
}

#[no_mangle]
pub unsafe extern "C" fn sdp_get_rids(attributes: *const Vec<SdpAttribute>, ret_size: size_t, ret_rids: *mut StringView) {
    let attrs: Vec<_> = (*attributes).iter().filter_map(|x| if let SdpAttribute::Rid(ref string) = *x {
        Some(StringView::from(string.as_str()))
    } else {
        None
    }).collect();
    let rids = slice::from_raw_parts_mut(ret_rids, ret_size);
    rids.copy_from_slice(attrs.as_slice());
}

#[repr(C)]
#[derive(Clone, Copy)]
pub struct RustSdpAttributeExtmap {
    pub id: uint16_t,
    pub direction: RustDirection,
    pub url: StringView,
    pub extension_attributes: StringView
}

impl<'a> From<&'a SdpAttributeExtmap> for RustSdpAttributeExtmap {
    fn from(other: &SdpAttributeExtmap) -> Self {
        RustSdpAttributeExtmap {
            id : other.id as uint16_t,
            direction: RustDirection::from(&other.direction),
            url: StringView::from(other.url.as_str()),
            extension_attributes: StringView::from(&other.extension_attributes)
        }
    }
}

#[no_mangle]
pub unsafe extern "C" fn sdp_get_extmap_count(attributes: *const Vec<SdpAttribute>) -> size_t {
    count_attribute((*attributes).as_slice(), RustSdpAttributeType::Extmap)
}

#[no_mangle]
pub unsafe extern "C" fn sdp_get_extmaps(attributes: *const Vec<SdpAttribute>, ret_size: size_t, ret_rids: *mut RustSdpAttributeExtmap) {
    let attrs: Vec<_> = (*attributes).iter().filter_map(|x| if let SdpAttribute::Extmap(ref data) = *x {
        Some(RustSdpAttributeExtmap::from(data))
    } else {
        None
    }).collect();
    let extmaps = slice::from_raw_parts_mut(ret_rids, ret_size);
    extmaps.copy_from_slice(attrs.as_slice());
}
