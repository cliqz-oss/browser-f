/*
 * Copyright (c) 2016, Alliance for Open Media. All rights reserved
 *
 * This source code is subject to the terms of the BSD 2 Clause License and
 * the Alliance for Open Media Patent License 1.0. If the BSD 2 Clause License
 * was not distributed with this source code in the LICENSE file, you can
 * obtain it at www.aomedia.org/license/software. If the Alliance for Open
 * Media Patent License 1.0 was not distributed with this source code in the
 * PATENTS file, you can obtain it at www.aomedia.org/license/patent.
 */

#ifndef AV1_ENCODER_RD_H_
#define AV1_ENCODER_RD_H_

#include <limits.h>

#if CONFIG_ANS
#include "aom_dsp/ans.h"
#endif  // CONFIG_ANS
#include "av1/common/blockd.h"

#include "av1/encoder/block.h"
#include "av1/encoder/context_tree.h"
#include "av1/encoder/cost.h"

#ifdef __cplusplus
extern "C" {
#endif

#define RDDIV_BITS 7
#define RD_EPB_SHIFT 6

#define RDCOST(RM, R, D)                                          \
  (ROUND_POWER_OF_TWO(((int64_t)R) * (RM), AV1_PROB_COST_SHIFT) + \
   (D << RDDIV_BITS))

#define RDCOST_DBL(RM, R, D)                                       \
  (((((double)(R)) * (RM)) / (double)(1 << AV1_PROB_COST_SHIFT)) + \
   ((double)(D) * (1 << RDDIV_BITS)))

#define QIDX_SKIP_THRESH 115

#define MV_COST_WEIGHT 108
#define MV_COST_WEIGHT_SUB 120

#define RD_THRESH_MAX_FACT 64
#define RD_THRESH_INC 1

// This enumerator type needs to be kept aligned with the mode order in
// const MODE_DEFINITION av1_mode_order[MAX_MODES] used in the rd code.
typedef enum {
  THR_NEARESTMV,
#if CONFIG_EXT_REFS
  THR_NEARESTL2,
  THR_NEARESTL3,
  THR_NEARESTB,
  THR_NEARESTA2,
#endif  // CONFIG_EXT_REFS
  THR_NEARESTA,
  THR_NEARESTG,

  THR_DC,

  THR_NEWMV,
#if CONFIG_EXT_REFS
  THR_NEWL2,
  THR_NEWL3,
  THR_NEWB,
  THR_NEWA2,
#endif  // CONFIG_EXT_REFS
  THR_NEWA,
  THR_NEWG,

  THR_NEARMV,
#if CONFIG_EXT_REFS
  THR_NEARL2,
  THR_NEARL3,
  THR_NEARB,
  THR_NEARA2,
#endif  // CONFIG_EXT_REFS
  THR_NEARA,
  THR_NEARG,

  THR_ZEROMV,
#if CONFIG_EXT_REFS
  THR_ZEROL2,
  THR_ZEROL3,
  THR_ZEROB,
  THR_ZEROA2,
#endif  // CONFIG_EXT_REFS
  THR_ZEROA,
  THR_ZEROG,

#if CONFIG_COMPOUND_SINGLEREF
  THR_SR_NEAREST_NEARMV,
#if CONFIG_EXT_REFS
  THR_SR_NEAREST_NEARL2,
  THR_SR_NEAREST_NEARL3,
  THR_SR_NEAREST_NEARB,
#endif  // CONFIG_EXT_REFS
  THR_SR_NEAREST_NEARG,
  THR_SR_NEAREST_NEARA,

  /*
  THR_SR_NEAREST_NEWMV,
#if CONFIG_EXT_REFS
  THR_SR_NEAREST_NEWL2,
  THR_SR_NEAREST_NEWL3,
  THR_SR_NEAREST_NEWB,
#endif  // CONFIG_EXT_REFS
  THR_SR_NEAREST_NEWG,
  THR_SR_NEAREST_NEWA,*/

  THR_SR_NEAR_NEWMV,
#if CONFIG_EXT_REFS
  THR_SR_NEAR_NEWL2,
  THR_SR_NEAR_NEWL3,
  THR_SR_NEAR_NEWB,
#endif  // CONFIG_EXT_REFS
  THR_SR_NEAR_NEWG,
  THR_SR_NEAR_NEWA,

  THR_SR_ZERO_NEWMV,
#if CONFIG_EXT_REFS
  THR_SR_ZERO_NEWL2,
  THR_SR_ZERO_NEWL3,
  THR_SR_ZERO_NEWB,
#endif  // CONFIG_EXT_REFS
  THR_SR_ZERO_NEWG,
  THR_SR_ZERO_NEWA,

  THR_SR_NEW_NEWMV,
#if CONFIG_EXT_REFS
  THR_SR_NEW_NEWL2,
  THR_SR_NEW_NEWL3,
  THR_SR_NEW_NEWB,
#endif  // CONFIG_EXT_REFS
  THR_SR_NEW_NEWG,
  THR_SR_NEW_NEWA,
#endif  // CONFIG_COMPOUND_SINGLEREF

  THR_COMP_NEAREST_NEARESTLA,
#if CONFIG_EXT_REFS
  THR_COMP_NEAREST_NEARESTL2A,
  THR_COMP_NEAREST_NEARESTL3A,
#endif  // CONFIG_EXT_REFS
  THR_COMP_NEAREST_NEARESTGA,
#if CONFIG_EXT_REFS
  THR_COMP_NEAREST_NEARESTLB,
  THR_COMP_NEAREST_NEARESTL2B,
  THR_COMP_NEAREST_NEARESTL3B,
  THR_COMP_NEAREST_NEARESTGB,
  THR_COMP_NEAREST_NEARESTLA2,
  THR_COMP_NEAREST_NEARESTL2A2,
  THR_COMP_NEAREST_NEARESTL3A2,
  THR_COMP_NEAREST_NEARESTGA2,
#if CONFIG_EXT_COMP_REFS
  THR_COMP_NEAREST_NEARESTLL2,
  THR_COMP_NEAREST_NEARESTLL3,
  THR_COMP_NEAREST_NEARESTLG,
  THR_COMP_NEAREST_NEARESTBA,
#endif  // CONFIG_EXT_COMP_REFS
#endif  // CONFIG_EXT_REFS

  THR_TM,

  THR_SMOOTH,
#if CONFIG_SMOOTH_HV
  THR_SMOOTH_V,
  THR_SMOOTH_H,
#endif  // CONFIG_SMOOTH_HV

  THR_COMP_NEAR_NEARLA,
  THR_COMP_NEW_NEARESTLA,
  THR_COMP_NEAREST_NEWLA,
  THR_COMP_NEW_NEARLA,
  THR_COMP_NEAR_NEWLA,
  THR_COMP_NEW_NEWLA,
  THR_COMP_ZERO_ZEROLA,

#if CONFIG_EXT_REFS
  THR_COMP_NEAR_NEARL2A,
  THR_COMP_NEW_NEARESTL2A,
  THR_COMP_NEAREST_NEWL2A,
  THR_COMP_NEW_NEARL2A,
  THR_COMP_NEAR_NEWL2A,
  THR_COMP_NEW_NEWL2A,
  THR_COMP_ZERO_ZEROL2A,

  THR_COMP_NEAR_NEARL3A,
  THR_COMP_NEW_NEARESTL3A,
  THR_COMP_NEAREST_NEWL3A,
  THR_COMP_NEW_NEARL3A,
  THR_COMP_NEAR_NEWL3A,
  THR_COMP_NEW_NEWL3A,
  THR_COMP_ZERO_ZEROL3A,
#endif  // CONFIG_EXT_REFS

  THR_COMP_NEAR_NEARGA,
  THR_COMP_NEW_NEARESTGA,
  THR_COMP_NEAREST_NEWGA,
  THR_COMP_NEW_NEARGA,
  THR_COMP_NEAR_NEWGA,
  THR_COMP_NEW_NEWGA,
  THR_COMP_ZERO_ZEROGA,

#if CONFIG_EXT_REFS
  THR_COMP_NEAR_NEARLB,
  THR_COMP_NEW_NEARESTLB,
  THR_COMP_NEAREST_NEWLB,
  THR_COMP_NEW_NEARLB,
  THR_COMP_NEAR_NEWLB,
  THR_COMP_NEW_NEWLB,
  THR_COMP_ZERO_ZEROLB,

  THR_COMP_NEAR_NEARL2B,
  THR_COMP_NEW_NEARESTL2B,
  THR_COMP_NEAREST_NEWL2B,
  THR_COMP_NEW_NEARL2B,
  THR_COMP_NEAR_NEWL2B,
  THR_COMP_NEW_NEWL2B,
  THR_COMP_ZERO_ZEROL2B,

  THR_COMP_NEAR_NEARL3B,
  THR_COMP_NEW_NEARESTL3B,
  THR_COMP_NEAREST_NEWL3B,
  THR_COMP_NEW_NEARL3B,
  THR_COMP_NEAR_NEWL3B,
  THR_COMP_NEW_NEWL3B,
  THR_COMP_ZERO_ZEROL3B,

  THR_COMP_NEAR_NEARGB,
  THR_COMP_NEW_NEARESTGB,
  THR_COMP_NEAREST_NEWGB,
  THR_COMP_NEW_NEARGB,
  THR_COMP_NEAR_NEWGB,
  THR_COMP_NEW_NEWGB,
  THR_COMP_ZERO_ZEROGB,

  THR_COMP_NEAR_NEARLA2,
  THR_COMP_NEW_NEARESTLA2,
  THR_COMP_NEAREST_NEWLA2,
  THR_COMP_NEW_NEARLA2,
  THR_COMP_NEAR_NEWLA2,
  THR_COMP_NEW_NEWLA2,
  THR_COMP_ZERO_ZEROLA2,

  THR_COMP_NEAR_NEARL2A2,
  THR_COMP_NEW_NEARESTL2A2,
  THR_COMP_NEAREST_NEWL2A2,
  THR_COMP_NEW_NEARL2A2,
  THR_COMP_NEAR_NEWL2A2,
  THR_COMP_NEW_NEWL2A2,
  THR_COMP_ZERO_ZEROL2A2,

  THR_COMP_NEAR_NEARL3A2,
  THR_COMP_NEW_NEARESTL3A2,
  THR_COMP_NEAREST_NEWL3A2,
  THR_COMP_NEW_NEARL3A2,
  THR_COMP_NEAR_NEWL3A2,
  THR_COMP_NEW_NEWL3A2,
  THR_COMP_ZERO_ZEROL3A2,

  THR_COMP_NEAR_NEARGA2,
  THR_COMP_NEW_NEARESTGA2,
  THR_COMP_NEAREST_NEWGA2,
  THR_COMP_NEW_NEARGA2,
  THR_COMP_NEAR_NEWGA2,
  THR_COMP_NEW_NEWGA2,
  THR_COMP_ZERO_ZEROGA2,

#if CONFIG_EXT_COMP_REFS
  THR_COMP_NEAR_NEARLL2,
  THR_COMP_NEW_NEARESTLL2,
  THR_COMP_NEAREST_NEWLL2,
  THR_COMP_NEW_NEARLL2,
  THR_COMP_NEAR_NEWLL2,
  THR_COMP_NEW_NEWLL2,
  THR_COMP_ZERO_ZEROLL2,

  THR_COMP_NEAR_NEARLL3,
  THR_COMP_NEW_NEARESTLL3,
  THR_COMP_NEAREST_NEWLL3,
  THR_COMP_NEW_NEARLL3,
  THR_COMP_NEAR_NEWLL3,
  THR_COMP_NEW_NEWLL3,
  THR_COMP_ZERO_ZEROLL3,

  THR_COMP_NEAR_NEARLG,
  THR_COMP_NEW_NEARESTLG,
  THR_COMP_NEAREST_NEWLG,
  THR_COMP_NEW_NEARLG,
  THR_COMP_NEAR_NEWLG,
  THR_COMP_NEW_NEWLG,
  THR_COMP_ZERO_ZEROLG,

  THR_COMP_NEAR_NEARBA,
  THR_COMP_NEW_NEARESTBA,
  THR_COMP_NEAREST_NEWBA,
  THR_COMP_NEW_NEARBA,
  THR_COMP_NEAR_NEWBA,
  THR_COMP_NEW_NEWBA,
  THR_COMP_ZERO_ZEROBA,
#endif  // CONFIG_EXT_COMP_REFS
#endif  // CONFIG_EXT_REFS

  THR_H_PRED,
  THR_V_PRED,
  THR_D135_PRED,
  THR_D207_PRED,
  THR_D153_PRED,
  THR_D63_PRED,
  THR_D117_PRED,
  THR_D45_PRED,

  THR_COMP_INTERINTRA_ZEROL,
  THR_COMP_INTERINTRA_NEARESTL,
  THR_COMP_INTERINTRA_NEARL,
  THR_COMP_INTERINTRA_NEWL,

#if CONFIG_EXT_REFS
  THR_COMP_INTERINTRA_ZEROL2,
  THR_COMP_INTERINTRA_NEARESTL2,
  THR_COMP_INTERINTRA_NEARL2,
  THR_COMP_INTERINTRA_NEWL2,

  THR_COMP_INTERINTRA_ZEROL3,
  THR_COMP_INTERINTRA_NEARESTL3,
  THR_COMP_INTERINTRA_NEARL3,
  THR_COMP_INTERINTRA_NEWL3,
#endif  // CONFIG_EXT_REFS

  THR_COMP_INTERINTRA_ZEROG,
  THR_COMP_INTERINTRA_NEARESTG,
  THR_COMP_INTERINTRA_NEARG,
  THR_COMP_INTERINTRA_NEWG,

#if CONFIG_EXT_REFS
  THR_COMP_INTERINTRA_ZEROB,
  THR_COMP_INTERINTRA_NEARESTB,
  THR_COMP_INTERINTRA_NEARB,
  THR_COMP_INTERINTRA_NEWB,

  THR_COMP_INTERINTRA_ZEROA2,
  THR_COMP_INTERINTRA_NEARESTA2,
  THR_COMP_INTERINTRA_NEARA2,
  THR_COMP_INTERINTRA_NEWA2,
#endif  // CONFIG_EXT_REFS

  THR_COMP_INTERINTRA_ZEROA,
  THR_COMP_INTERINTRA_NEARESTA,
  THR_COMP_INTERINTRA_NEARA,
  THR_COMP_INTERINTRA_NEWA,
  MAX_MODES
} THR_MODES;

typedef enum {
  THR_LAST,
#if CONFIG_EXT_REFS
  THR_LAST2,
  THR_LAST3,
  THR_BWDR,
  THR_ALTR2,
#endif  // CONFIG_EXT_REFS
  THR_GOLD,
  THR_ALTR,

  THR_COMP_LA,
#if CONFIG_EXT_REFS
  THR_COMP_L2A,
  THR_COMP_L3A,
#endif  // CONFIG_EXT_REFS
  THR_COMP_GA,

#if CONFIG_EXT_REFS
  THR_COMP_LB,
  THR_COMP_L2B,
  THR_COMP_L3B,
  THR_COMP_GB,

  THR_COMP_LA2,
  THR_COMP_L2A2,
  THR_COMP_L3A2,
  THR_COMP_GA2,
#endif  // CONFIG_EXT_REFS

  THR_INTRA,

  MAX_REFS
} THR_MODES_SUB8X8;

typedef struct RD_OPT {
  // Thresh_mult is used to set a threshold for the rd score. A higher value
  // means that we will accept the best mode so far more often. This number
  // is used in combination with the current block size, and thresh_freq_fact
  // to pick a threshold.
  int thresh_mult[MAX_MODES];
  int thresh_mult_sub8x8[MAX_REFS];

  int threshes[MAX_SEGMENTS][BLOCK_SIZES_ALL][MAX_MODES];

  int64_t prediction_type_threshes[TOTAL_REFS_PER_FRAME][REFERENCE_MODES];

  int RDMULT;
} RD_OPT;

static INLINE void av1_init_rd_stats(RD_STATS *rd_stats) {
#if CONFIG_RD_DEBUG
  int plane;
#endif
  rd_stats->rate = 0;
  rd_stats->dist = 0;
  rd_stats->rdcost = 0;
  rd_stats->sse = 0;
  rd_stats->skip = 1;
  rd_stats->zero_rate = 0;
  rd_stats->invalid_rate = 0;
  rd_stats->ref_rdcost = INT64_MAX;
#if CONFIG_RD_DEBUG
  for (plane = 0; plane < MAX_MB_PLANE; ++plane) {
    rd_stats->txb_coeff_cost[plane] = 0;
#if CONFIG_VAR_TX
    {
      int r, c;
      for (r = 0; r < TXB_COEFF_COST_MAP_SIZE; ++r)
        for (c = 0; c < TXB_COEFF_COST_MAP_SIZE; ++c)
          rd_stats->txb_coeff_cost_map[plane][r][c] = 0;
    }
#endif
  }
#endif
}

static INLINE void av1_invalid_rd_stats(RD_STATS *rd_stats) {
#if CONFIG_RD_DEBUG
  int plane;
#endif
  rd_stats->rate = INT_MAX;
  rd_stats->dist = INT64_MAX;
  rd_stats->rdcost = INT64_MAX;
  rd_stats->sse = INT64_MAX;
  rd_stats->skip = 0;
  rd_stats->zero_rate = 0;
  rd_stats->invalid_rate = 1;
  rd_stats->ref_rdcost = INT64_MAX;
#if CONFIG_RD_DEBUG
  for (plane = 0; plane < MAX_MB_PLANE; ++plane) {
    rd_stats->txb_coeff_cost[plane] = INT_MAX;
#if CONFIG_VAR_TX
    {
      int r, c;
      for (r = 0; r < TXB_COEFF_COST_MAP_SIZE; ++r)
        for (c = 0; c < TXB_COEFF_COST_MAP_SIZE; ++c)
          rd_stats->txb_coeff_cost_map[plane][r][c] = INT_MAX;
    }
#endif
  }
#endif
}

static INLINE void av1_merge_rd_stats(RD_STATS *rd_stats_dst,
                                      const RD_STATS *rd_stats_src) {
#if CONFIG_RD_DEBUG
  int plane;
#endif
  rd_stats_dst->rate += rd_stats_src->rate;
  rd_stats_dst->dist += rd_stats_src->dist;
  rd_stats_dst->sse += rd_stats_src->sse;
  rd_stats_dst->skip &= rd_stats_src->skip;
  rd_stats_dst->invalid_rate &= rd_stats_src->invalid_rate;
#if CONFIG_RD_DEBUG
  for (plane = 0; plane < MAX_MB_PLANE; ++plane) {
    rd_stats_dst->txb_coeff_cost[plane] += rd_stats_src->txb_coeff_cost[plane];
#if CONFIG_VAR_TX
    {
      // TODO(angiebird): optimize this part
      int r, c;
      int ref_txb_coeff_cost = 0;
      for (r = 0; r < TXB_COEFF_COST_MAP_SIZE; ++r)
        for (c = 0; c < TXB_COEFF_COST_MAP_SIZE; ++c) {
          rd_stats_dst->txb_coeff_cost_map[plane][r][c] +=
              rd_stats_src->txb_coeff_cost_map[plane][r][c];
          ref_txb_coeff_cost += rd_stats_dst->txb_coeff_cost_map[plane][r][c];
        }
      assert(ref_txb_coeff_cost == rd_stats_dst->txb_coeff_cost[plane]);
    }
#endif
  }
#endif
}

static INLINE int av1_get_coeff_token_cost(int token, int eob_val, int is_first,
                                           const int *head_cost_table,
                                           const int *tail_cost_table) {
  if (eob_val == LAST_EOB) return av1_cost_zero(128);
  const int comb_symb = 2 * AOMMIN(token, TWO_TOKEN) - eob_val + is_first;
  int cost = head_cost_table[comb_symb];
  if (token > ONE_TOKEN) cost += tail_cost_table[token - TWO_TOKEN];
  return cost;
}

struct TileInfo;
struct TileDataEnc;
struct AV1_COMP;
struct macroblock;

int av1_compute_rd_mult(const struct AV1_COMP *cpi, int qindex);

void av1_initialize_rd_consts(struct AV1_COMP *cpi);

void av1_initialize_me_consts(const struct AV1_COMP *cpi, MACROBLOCK *x,
                              int qindex);

void av1_model_rd_from_var_lapndz(int64_t var, unsigned int n,
                                  unsigned int qstep, int *rate, int64_t *dist);

int av1_get_switchable_rate(const AV1_COMMON *const cm, MACROBLOCK *x,
                            const MACROBLOCKD *xd);

int av1_raster_block_offset(BLOCK_SIZE plane_bsize, int raster_block,
                            int stride);

int16_t *av1_raster_block_offset_int16(BLOCK_SIZE plane_bsize, int raster_block,
                                       int16_t *base);

YV12_BUFFER_CONFIG *av1_get_scaled_ref_frame(const struct AV1_COMP *cpi,
                                             int ref_frame);

void av1_init_me_luts(void);

void av1_set_mvcost(MACROBLOCK *x, MV_REFERENCE_FRAME ref_frame, int ref,
                    int ref_mv_idx);

void av1_get_entropy_contexts(BLOCK_SIZE bsize, TX_SIZE tx_size,
                              const struct macroblockd_plane *pd,
                              ENTROPY_CONTEXT t_above[2 * MAX_MIB_SIZE],
                              ENTROPY_CONTEXT t_left[2 * MAX_MIB_SIZE]);

void av1_set_rd_speed_thresholds(struct AV1_COMP *cpi);

void av1_set_rd_speed_thresholds_sub8x8(struct AV1_COMP *cpi);

void av1_update_rd_thresh_fact(const AV1_COMMON *const cm,
                               int (*fact)[MAX_MODES], int rd_thresh, int bsize,
                               int best_mode_index);

static INLINE int rd_less_than_thresh(int64_t best_rd, int thresh,
                                      int thresh_fact) {
  return best_rd < ((int64_t)thresh * thresh_fact >> 5) || thresh == INT_MAX;
}

void av1_mv_pred(const struct AV1_COMP *cpi, MACROBLOCK *x,
                 uint8_t *ref_y_buffer, int ref_y_stride, int ref_frame,
                 BLOCK_SIZE block_size);

static INLINE void set_error_per_bit(MACROBLOCK *x, int rdmult) {
  x->errorperbit = rdmult >> RD_EPB_SHIFT;
  x->errorperbit += (x->errorperbit == 0);
}

void av1_setup_pred_block(const MACROBLOCKD *xd,
                          struct buf_2d dst[MAX_MB_PLANE],
                          const YV12_BUFFER_CONFIG *src, int mi_row, int mi_col,
                          const struct scale_factors *scale,
                          const struct scale_factors *scale_uv);

int av1_get_intra_cost_penalty(int qindex, int qdelta,
                               aom_bit_depth_t bit_depth);

void av1_fill_mode_rates(AV1_COMMON *const cm, MACROBLOCK *x,
                         FRAME_CONTEXT *fc);

#if CONFIG_LV_MAP
void av1_fill_coeff_costs(MACROBLOCK *x, FRAME_CONTEXT *fc);
#endif

void av1_fill_token_costs_from_cdf(av1_coeff_cost *cost,
                                   coeff_cdf_model (*cdf)[PLANE_TYPES]);

#ifdef __cplusplus
}  // extern "C"
#endif

#endif  // AV1_ENCODER_RD_H_
