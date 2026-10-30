# Round 2 — numeric verification of the physics revision

Reviewer: round-2 numeric verifier. Scope: `docs/specs/physics/*.md` (12 files, including the new
`10-chassis.md`) and `docs/specs/spec.md` §4. Method: every value below was recomputed from the
geometry and constants the documents themselves state, using throwaway Python in
`/opt/data/cache/scratch/verify/` (four-bar solver, plan-view circle solver, module-6 chain, module-7
orifice model). No value was taken from the revision's own report, and no claim from the previous
reviewer was inherited — the files were read fresh after the revision landed (`5e61c1c`).

**Headline: 12 of 12 groups reproduce.** Seven match every printed digit; five (4, 5, 7, 9, 10) differ
only in a last digit (≤0.06 pp, 0.001 Hz, 0.01 mm) — none beyond the document's own tolerance. The
`-1.223 %` residual,
however, is reproducible *only* from an `x_cg` that contradicts the same document's weight split
(D-1), and the ride-height algorithm in `01` §6.2 is labelled with the opposite of its own sign
convention (D-2). Nothing in the twelve groups is fabricated; the errors are internal
inconsistencies that a reader would not notice and an implementer would.

---

## 1. Method, and what "reproduced" means

- Module 2: transverse-plane four-bar as specified in (2.1)–(2.4), crank solved by bisection for
  `W.z = R + bump` with the carrier offsets of §8.3, branch chosen to reproduce the measured `Uₒ`.
  IC from (2.7), `z_rc` from (2.9).
- Module 4: plan-view circle intersection (4.5)–(4.8) with `ρ` held fixed, `r_p` re-derived from
  `z_Tₒ(bump)` (4.10), τ toe-in positive (4.12). The right corner uses the mirrored axis ground
  point `A_R = (259.9459, −78.9838)`; using the left one fails to intersect, which is itself a check
  that the doc's right-hand arithmetic (`D = 65.1493`) came from the mirrored axis.
- Module 2 §9 Jacobian: perturb one coordinate, re-derive the carrier offsets from the perturbed
  static state (the wheel stays where it was measured), re-solve for `W.z = 32.000`, recompute IC and
  κ. This is the only reading that reproduces the table; it is an assumption, listed in §15.
- Modules 5/7: IR by central difference on θ with `h = 1e-3 rad` (the stated shipped value), the
  arm-rotation rule for `D_lo`, then (5.4), (5.11), (5.12), (7.5)–(7.7).
- Module 6: (6.1)–(6.10) with the stated inputs; the flexible-chassis system (10.7) solved as written.
- Verdicts: **exact** = agrees with the value as printed at its own precision; **rounding** = differs
  in the last printed digit or by ≤0.05 pp/0.001 Hz; **wrong** = differs beyond the document's own
  tolerance.

---

## 2. Group 1 — module 2 sensitivity Jacobian (`02` §9)

| Claimed | Computed | Verdict |
|---|---|---|
| Lₒ.z +0.1 → Δz_rc −0.1869 mm | −0.18686 | exact |
| Lₒ.y +0.1 → Δz_rc −0.0194 mm | −0.01938 | exact |
| Uₒ.y +0.1 → Δz_rc +0.0014 mm | +0.00136 | exact |
| Uₒ.z +0.1 → Δz_rc +0.0420 mm | +0.04198 | exact |
| Uᵢ.y +0.1 → Δz_rc −0.0015 mm | −0.00153 | exact |
| Uᵢ.z +0.1 → Δz_rc −0.0449 mm | −0.04490 | exact |
| dκ: Lₒ.y −0.27 %, Lₒ.z −2.60 % | −0.270 %, −2.602 % | exact |
| dκ: Uₒ.y +0.13 %, Uₒ.z +4.13 % | +0.135 %, +4.132 % | exact |
| dκ: Uᵢ.y −0.14 %, Uᵢ.z −4.42 % | −0.144 %, −4.420 % | exact |
| Lₒ.z +0.2 → −0.3749 (−5.22 %) | −0.3749 (−5.221 %) | exact |
| Lₒ.z +0.5 → −0.9463 (−13.18 %) | −0.9463 (−13.177 %) | exact |
| Lₒ.z +1.0 → −1.9230 (−26.78 %) | −1.9230 (−26.778 %) | exact |
| 1 mm camber-link shim (Uᵢ.z +1.0) → −0.4539 mm | −0.4539 | exact |
| Uᵢ.y +1.0 (lengthening the link) → −0.0151 mm | −0.0151 | exact |
| "0.5 mm of Lₒ.z error moves the RC twice as far as the 1 mm shim" | 0.9463 vs 0.4539 = 2.08× | exact |

## 3. Group 2 — mirroring (`02` §3.6, `01` §6.1)

| Claimed | Computed | Verdict |
|---|---|---|
| κ_LF per wheel −0.109816 °/mm | −0.1098161 | exact |
| κ_RF global +0.109816 | +0.109816 | exact |
| κ_RF per wheel (with `s`) −0.109816 | −0.109816 | exact |
| mirrored θ₀ −174.05° | −174.0531° | exact |
| mirrored branch sign −1 | −1 | exact |
| dW.z/dθ +48.7475 mm/rad (LF) | +48.7475 | exact |
| dW.z/dθ −48.7475 (mirror) | −48.7475 | exact |
| γ_kp = −8.0000° both sides | −7.99998° | exact |
| un-signed RF gives +8.0000°, κ +0.109816, (2.16) → 1.165 °/° | +8.0000, +0.109816, 1.1648 | exact |

## 4. Group 3 — carrier transform and the toe-driving column (`02` §6.9, `01` §8.3)

| Claimed | Computed | Verdict |
|---|---|---|
| `tie_out` carrier (u, v) = (25.3078, 0.4421) | (25.30783, 0.44214) | exact |
| `wc` carrier (u, v) = (23.6433, −11.4015) | (23.64332, −11.40147) | exact |
| z_Tₒ carrier rule at −2 −1 0 +1 +2 +4: 30.039 / 31.021 / 32.000 / 32.975 / 33.948 / 35.882 | 30.0391 / 31.0212 / 32.0000 / 32.9754 / 33.9475 / 35.8818 | exact |
| crank-angle rule 30.168 / 33.782 / 35.517 (at −2, +2, +4) | 30.1682 / 33.7825 / 35.5171 | exact |
| Δ = +0.252° at +2 mm | +0.2515° | exact |
| tie_out at +2 = (74.0543, 33.948) | (74.0945, 33.9475) — y differs by 0.040 mm | see D-10 |

## 5. Group 4 — sprung masses, frequencies, critical damping, ζ (`05` §6, `07` §6)

| Claimed | Computed | Verdict |
|---|---|---|
| IR (θ-step) 0.565308 | 0.565308 | exact |
| IR (1 mm wheel step) 0.565331 | 0.565331 | exact |
| L_d static 51.6649 mm; at ±1: 51.0989 / 52.2295 | 51.6649; 51.0989 / 52.2295 | exact |
| IR at −5 / 0 / +5: 0.5597 / 0.5653 / 0.5744 | 0.55972 / 0.56531 / 0.57441 | exact |
| r_s 30.1623; ê_s·ê_t 0.91364 | 30.1623; 0.91364 | exact |
| closed form IR 0.56532 | 0.56531 | exact |
| textbook form 0.5741 (48.000 vs 48.748 mm/rad) | 0.57412; 48.2597×0.99462 = 47.9998 | exact |
| k_w,f = 3.50 × 0.565308² = 1.11851 N/mm | 1.11851 | exact |
| k_w,r = 2.60 × 0.7071² = 1.29998 (1.30000) | 1.29998 | exact |
| m_s 0.24375 front / 0.31125 rear per corner | 0.24375 / 0.31125 **as assigned** | correct arithmetic — see D-1 |
| f_front 10.782 Hz | **10.7812** | rounding (D-6) |
| f_rear 10.286 Hz | 10.2857 | exact |
| c_crit 33.023 / 40.230 N·s/m | 33.023 / 40.230 | exact |
| ζ at 5 mm/s 0.0256 | 0.02563 | exact |
| ζ at 20 0.1022 | 0.10224 | exact |
| ζ at 50 0.2556 | 0.25563 | exact |
| ζ at 99.1 0.5066 (table prints 0.507) | 0.50654 | rounding |
| ζ at 200 0.3097 | 0.30972 | exact |
| ζ at 500 0.1935 | 0.19353 | exact |
| ζ(IR 0.500) = 0.2261, k_w 874.9 N/m, c_crit 29.21 | 0.22606; 875.0; 29.207 | exact |
| v_bo 0.09912 m/s | 0.099119 | exact |
| K_h 528.20 | 528.19 | exact |
| A_p 67.5 mm²; bore-area error 7 % | 67.47; 7.3 % | exact |

## 6. Group 5 — the ζ direction table (`07` §9)

| Claimed | Computed | Verdict |
|---|---|---|
| µ ×1.5: 0 % at 50 mm/s | 0.2556 → 0.2556 | exact |
| µ ×1.5: +50 % at 200 mm/s (0.3097 → 0.4645) | 0.4645 (+50.0 %) | exact |
| IR 0.500 (−11.5 %): ζ −11.6 % at 50 (0.2261) | 0.22606 (−11.6 %) | exact |
| IR 0.500 at 200: 0.2739 (−11.6 %) | 0.27391 | exact |
| k_s +20 %: 0.2333 (−8.7 %) at 50 | 0.23329 (−8.73 %) | exact |
| k_s +20 %: 0.2828 at 200 | 0.28272 | exact |
| n 3→4: 0.1438 (−43.7 %) at 50 | 0.14377 (−43.76 %) | rounding |
| n 3→4: v_bo 99 → 138 mm/s | 0.13795 m/s | exact |
| d_h 0.60→0.62: 0.2242 (−12.3 %) | 0.22418 (−12.31 %) | exact |
| +10 °C: 0 % at 50, −12.6 % at 200 (0.2706) | 0.2556; 0.27064 | exact |
| µ(30)/µ(20) = 0.8737 with B = 1200 K | 0.87371 | exact |

## 7. Group 6 — chassis module (`10` §4)

| Claimed | Computed | Verdict |
|---|---|---|
| k_ch CFRP 2.0 = 21.60 N·m/rad (J = 2.400e-10) | 21.600; 2.400e-10 | exact |
| k_ch CFRP 2.5 = 42.19 (J = 4.688e-10) | 42.1875; 4.6875e-10 | exact |
| k_ch 6061 2.0 = 20.80 | 20.800 | exact |
| k_ch 6061 2.5 = 40.63 | 40.625 | exact |
| k_ch steel 2.0 = 63.20 | 63.200 | exact |
| k_ch steel 2.5 = 123.44 | 123.438 | exact |
| 0.3770 N·m/deg at 21.60; 1.103 at 63.20; 2.154 at 123.44 | 0.3770; 1.1030; 2.1543 | exact |
| plate masses 83.7 / 104.6 / 145.8 / 423.9 / 529.9 g | 83.7 / 104.63 / 145.8 / 423.9 / 529.88 | exact |
| carbon:steel = 2.9× | 2.926 | exact |
| t³ law 2.0→2.5 = ×1.953 | 1.9531 | exact |
| Det = 2475.3 | 2475.27 | exact |
| φ_f 0.18494°, φ_r 0.23080° | 0.184942°, 0.230787° | exact |
| twist 2.75 arcmin | 2.751 | exact |
| balance 52.63 % at k_ch 21.60 | 52.625 % | exact |
| ΔW_el,f 0.69949, ΔW_el,r 0.65674 | 0.69952 / 0.65674 | exact |
| table: 123.44 → 0.19940/0.21180/55.19 | 0.19941/0.21180/55.19 | exact |
| table: 63.20 → 0.19534/0.21714/54.47 | 0.19534/0.21714/54.47 | exact |
| table: 42.19 → 0.19194/0.22160/53.87 | 0.19194/0.22160/53.87 | exact |
| G10.9: 0.80 N·m/deg = 45.84 N·m/rad → 54.0 % | 45.837 → 54.00 % | exact |
| Δm +20.9 g; Δ(m·h) +167; +555; total +722 = +1.91 % | 20.93; 167.4; 555; 722.4; 1.911 % | exact |
| steel Δm +340 g → +2720 g·mm = +7.2 % | 340.2; 2721.6; 7.20 % | exact |

## 8. Group 7 — toe table and Ackermann (`04` §6)

| Claimed | Computed | Verdict |
|---|---|---|
| ρ 17.0000 mm; L 51.5843; r_p 51.5455 | 17.0000; 51.5843; 51.5455 | exact |
| τ at −4…+4: +0.010 / +0.166 / +0.123 / 0 / −0.202 / −0.484 / −1.289 | +0.010 / +0.166 / +0.123 / 0.000 / −0.202 / −0.484 / −1.290 | exact (last row −0.001) |
| z_Tₒ column −4…+4: 28.064 … 35.882 | 28.0641 … 35.8818 | exact |
| r_p column 51.5480 / 51.5843 / 51.5742 / 51.5455 / 51.4984 / 51.4330 / 51.2479 | 51.5479 / 51.5842 / 51.5741 / 51.5455 / 51.4984 / 51.4330 / 51.2478 | exact |
| coefficient −0.1625 °/mm (τ(±0.2) = −0.03403 / +0.03096) | −0.1625 (−0.03408 / +0.03091) | exact |
| chord ±2: (−0.484 − 0.166)/4 = −0.163 | −0.1626 | exact |
| Ackermann at rack +2 = 127.06 % | 127.06 % | exact |
| δ_left −7.6032°, δ_right −8.5627° | −7.6030 / −8.5629 | exact |
| α table: 76.5 / 99.0 / 127.1 / 163.7 / 215.5 % | 76.5 / 99.0 / 127.1 / 163.7 / 215.5 % | exact |
| r_p at α: 54.051 / 52.758 / 51.545 / 50.430 / 49.425 | 54.051 / 52.758 / 51.545 / 50.430 / 49.425 | exact |
| δ at α = −5: (−7.202, −7.852); +10: (−8.854, −11.360) | (−7.202, −7.852); (−8.854, −11.360) | exact |
| 5° of arm = 28 pp rearward, 37 pp forward | 28.1 / 36.6 | exact |
| abs(A.x − Tᵢ.x) = 34.9459 > abs(r_p − ρ) = 34.5455 (noIntersection unreachable) | 34.9459 > 34.5455 | exact |
| G04.8: rack +0.10 → abs(δ_inner) 0.400°; +0.30 → 1.209° | 0.4006; 1.2090 | exact |
| Δρ = sin 8° × 2 mm = 0.279 mm = 1.6 % of 17 | 0.2783; 1.64 % | exact |
| working-height axis: ρ 11.95 mm, 42 % overstatement | 11.95; 17/11.95 = 1.423 | exact |

## 9. Group 8 — side-view readings (`03` §3.1, §5)

| Claimed | Computed | Verdict |
|---|---|---|
| hinge axis (z = 12) → SVIC (382.0, 12.0), x_ic > x_cp | (382.0, 12.0) | exact |
| vertical constraint (x = 259) → (259.0, 42.75) | (259.0, 42.75) | exact |
| midpoint x = 255 reading → (223.25, 51.69) | (223.25, 51.6875) | exact |
| θ_f 56.86° | 56.857° | exact |
| anti-dive 773.1 % | 773.12 % (tan θ = 1.53148, ×9.1786×0.55) | exact |
| axis tilted 11.5° → (1005, −144) | (1004.96, −143.74) | exact |
| G03.1 θ_r 23.963°, anti-squat 407.9 % | 23.9625°; 407.94 % | exact |
| 100 % condition θ = 6.218° (h/l = 0.109) | 6.2178°; tan×9.1786 = 1.00003 | exact |
| G03.6 θ_f 23.2°, anti-dive 216.4 % | 23.199°; 216.37 % | exact |

## 10. Group 9 — camber-gain secants (`02` §7, `99` §2.1/§3.3)

| Claimed | Computed | Verdict |
|---|---|---|
| one-sided 0→+5 secant −0.149395 °/mm | −0.149395 | exact |
| = +36.0 % of κ | +36.04 % | exact |
| central ±5 −0.108669 (−1.0 %) | −0.108669 | exact |
| central ±2.5 −0.109548 (−0.2 %) | −0.109548 (−0.24 %) | exact |
| droop-side secant −0.068 (−38 %) | −0.067942 (−38.1 %) | exact |
| γ_kp at +5 / −5: −8.747 / −7.660 | −8.7470 / −7.6603 | exact |
| V3 floor 0.37–0.94 mm from 0.2–0.5 mm | 0.374 / 0.935 → 0.37–0.93 | rounding |

## 11. Group 10 — balance sensitivity (`06` §6.7, `99` §2.1)

| Claimed | Computed | Verdict |
|---|---|---|
| bar d ±0.05 mm → ±1.2 pp | +1.17 / −1.15 → ±1.16 | exact |
| arm ±1 mm → 0.84 pp | −1 mm: −0.837 (→ 0.84); +1 mm: +0.912 | exact one-sided, asymmetric |
| span ±5 mm → 0.46 pp | −5 mm: −0.468 (→ 0.47); +5 mm: +0.504 | rounding |
| spring ±5 % → 0.4 pp | +0.344 / −0.353 | rounding (0.4 is 14 % high) |
| CG height → 0.14 pp (24–32 mm) | 0.135 | exact |
| unknown chassis stiffness → 3.5 pp | 56.144 − 52.625 = 3.52 | exact |
| quadrature ≈ ±1.5 pp | 1.58 | exact |
| bar ±0.05 = ±14 % of the bar, ±7.8 % of k_φ,f | 13.4 %; 7.5 % | exact |
| chassis: ±20 % at k_ch 21.6 → ±0.26 pp (`99` V15) | ±0.41 pp | **wrong** (D-4) |
| "3× wrong → 2 pp" (`99` §11) | 1.85 pp | rounding |
| "3 mm CG error → 0.12 pp" (`06` §6.7) | 0.090 pp | **wrong** (D-5) |
| "±1.6 % of load per mm of h" (`06` §6.7) | 3.57 %/mm | **wrong** (D-5) |

## 12. Group 11 — load transfer (`06` §6.4–6.5, G06.9)

| Claimed | Computed | Verdict |
|---|---|---|
| TLLT 2.1435 N (= 16 % of 13.24 N) | 2.14346; 16.19 % | exact |
| h_s 29.7297 mm | 29.72973 | exact |
| h_ra 8.186 mm | 8.18620 (on the doc's `x_cg`) | exact — but see D-1 |
| M_el 0.23459 N·m; φ 0.20476° | 0.234590; 0.204762 | exact — but see D-1 |
| ΔW_el,f 0.77445, ΔW_el,r 0.58265 | 0.774470 / 0.582648 | exact |
| ΔW_geo,f 0.27735, ΔW_geo,r 0.21058 | 0.277347 / 0.210577 | exact |
| ΔW_u,f 0.13688, ΔW_u,r 0.13531 | 0.136884 / 0.135310 | exact |
| ΔW_f 1.18868, ΔW_r 0.92854, sum 2.11722 | 1.188701 / 0.928536 / 2.117237 | exact |
| balance 56.14 % | 56.144 | exact |
| residual −1.223 % | −1.2233 | exact — but see D-1 |
| front outer 3.5741 N (120.0 %), inner 2.3854 N (80.1 %) | 3.57414 (119.95 %); 2.38544 (80.05 %) | exact |
| inner + outer = 2 × static (2.9798) | 5.95958 = 2 × 2.97979 | exact |
| rear outer 112.7 % / inner 87.3 % | 112.74 / 87.26 | exact |
| §6.7 table (24…32 mm): 0.18162/0.1585/1.8372/55.99 … 0.28756/0.2510/2.4497/56.26 | identical to 5 dp | exact |
| §6.8: M_f 0.10303, M_r 0.13156 | 0.103029 / 0.131560 | exact |
| G06.9 (h = 18.693): TLLT 1.4310, φ 0.09718, balance 55.68 | 1.43099; 0.097183; 55.675 | exact |

## 13. Group 12 — CG height (`01` §4.5)

| Claimed | Computed | Verdict |
|---|---|---|
| Σ m_s = 1110 g | 84+190+210+45+60+85+436 = 1110 | exact |
| Σ m_s·z = 20 436 g·mm | 672+4180+3780+1080+1560+3060+6104 = 20436 | exact |
| h_s = 18.411 mm | 18.4108 | exact |
| h = (20436 + 240×20)/1350 = 18.693 mm | 18.69333 | exact |
| "9.3 mm below 28.0" | 9.307 | exact |
| "a 33 % change in every absolute load number" | 18.693/28 = 0.668 (−33.2 %) | exact |

---

## 14. Discrepancies, ranked by consequence

### D-1 (high) — `x_cg = 141.35 mm` contradicts the 45 % front weight split, and the −1.223 % residual exists only because of it

`06` §6.1 states **front weight fraction 0.45** and derives `m_s,f = 0.48749 kg/axle` (0.24375/corner),
`m_s,r = 0.62249 kg/axle` (0.31125/corner), `sprung front fraction 0.43919`. `06` §6.3 then writes

```
x_cg = 257 × (1 − 0.45) = 141.35 mm
```

which is the **55 %**-front value. With `w_f = 0.45` the CG sits 0.45·257 = **115.65 mm** from the rear
axle. (`01` §8.1 repeats 141.35 and labels it "derived from the 45/55 front/rear split"; `01` §5's JSON
carries `"cg": {"x": 141.35}`.) The two cannot both be true: 141.35 mm is 25.7 mm **forward** of where
a 45 %-front car's CG can be, and it sits ahead of mid-wheelbase — a front-heavy car, which the
masses in the same section (front axle lighter) contradict.

Everything downstream of `h_ra` inherits it. Recomputing with `x_cg = 115.65` and every other input
unchanged:

| Quantity | As printed | Corrected | Where it is repeated |
|---|---|---|---|
| x_cg | 141.35 mm | **115.65 mm** | 01 §5 JSON, 01 §8.1, 06 §6.3 |
| h_ra | 8.186 mm | **7.789 mm** | 06 §6.3, G06.3 |
| M_el | 0.23459 N·m | **0.23892 N·m** | 06 §6.3, §6.7 table, §6.8, G06.3, 10 §4.2 |
| φ | 0.20476° | **0.20854°** | 06 §6.3, §6.7, §6.8, G06.3, G10.4, 10 §4.2 (rigid row) |
| ΔW_el,f | 0.77445 N | **0.78876 N** | 06 §6.4, 10 §4.2 |
| ΔW_el,r | 0.58265 N | **0.59340 N** | 06 §6.4, 10 §4.2 |
| balance (rigid) | 56.14 % | **56.15 %** | 06 §6.4–6.5, §6.7, §6.8, G06.4, G10.4, 99 §7 |
| residual | −1.223 % | **−0.055 %** | 06 §3.7, §6.5, G06.8, 99 I10 |
| M_f / M_r | 0.10303 / 0.13156 | **0.10493 / 0.13399** | 06 §6.8, 10 §4.2 |
| φ_f / φ_r at k_ch 21.60 | 0.18494 / 0.23080 | **0.18836 / 0.23506** | 06 §6.8, G06.10, 10 §4.2, G10.5 |
| balance at k_ch 21.60 | 52.63 % | **52.61 %** | 06 §6.8, G06.10, 10 §4.2, G10.5, 99 §11 |
| 10 §4.2 table (123.44 / 63.20 / 42.19) | 0.19940 / 0.19534 / 0.19194 | **0.20309 / 0.19894 / 0.19549** | 10 §4.2, 99 §11 |
| G06.9 (h = 18.693) φ / balance | 0.09718° / 55.68 % | **0.10095° / 55.70 %** | G06.9 |

Two things follow that matter more than the numbers:

1. **The residual narrative is wrong.** `06` §3.7 and 99 I10 explain a −1.223 % residual with a
   three-way decomposition argument ("the geometric term is distributed by sprung force fraction while
   the reference is a whole-car `m·a·h/t̄` …"). On a self-consistent `x_cg` the reference car's residual
   is **−0.055 %** — the identity nearly holds, and I10's whole justification for a loosened 5 % pass
   mark describes an artefact of this arithmetic slip, not the model. (The residual does vary with `h`:
   on the corrected basis it is −0.12 % at `h = 18.693 mm`. It is the reference-car figure and the
   explanation attached to it that are wrong.)
2. **Only one of the two inputs can be kept.** If instead `w_f = 0.55` is adopted to match 141.35, then
   `06` §6.1 (corner weights), §6.4 (`ΔW_geo`), the 56.14 % balance (→ **58.91 %**), `05`/`07`'s
   frequencies (10.781/10.286 → **9.541 / 11.623 Hz**), every ζ in `07` §6 and §9, and `00` §5 all move.
   That is the expensive fix; the cheap and clearly intended one is `x_cg = 115.65`.

Reproduce check for the report's own claim: the printed chain (h_ra, M_el, φ, the four ΔW terms,
balance, residual) reproduces **exactly** from the printed inputs — the document is internally
consistent in its arithmetic and inconsistent in its inputs.

### D-2 (high) — `01` §6.2's ride-height algorithm is labelled with the opposite of its own sign convention

`01` §6.2 step 1: *"translate chassis-side points (lca_in_*, uca_in*, tie_in, damper_up) by +dz — dz > 0
raises the chassis relative to the wheels, **i.e. bump**"*. In module 2's convention (02 §2, §3.5:
`bump_left = −(t/2)·φ` for left-side-up), raising the chassis relative to the wheels is **droop**: the
wheel moves *down* relative to the chassis.

This is not pedantry — it changes the number the algorithm produces. On the reference car:

- chassis up 0.5 mm (the `underside_clearance` plate-thickness case): `z_rc = 10.7049` mm (+0.73);
- the label's reading ("bump +0.5"): `z_rc = 9.2617` mm (**−0.71**).

Those differ by 1.44 mm — larger than the ±1 mm band `99` §7 puts on roll-centre height. `10` §4.3 and
G10.7 use the first (10.7049) and call it droop, so `10` and `02` §6.6 are right and `01` §6.2's label is
wrong. Corrected text: *"dz > 0 raises the chassis relative to the wheels, i.e. droop of the wheel"*, or
drop the "i.e. bump". Inheritors: `01` §6.2, and any implementer writing `setRideHeight` from it;
`10` §3.4/§4.3 and G10.7 are consistent with the corrected reading and need no change.

### D-3 (medium-high) — `spec.md` §4.8 contradicts `01` §4.4 and `07` twice, in the shipped contract

`spec.md` §4.8 says: *"A fixed '±30%' label is **not acceptable** — the band must move when the inputs'
tolerances move"*, and lists `damper_blowoff_force` among the fields that are `on_absence: REFUSE`
("Without them ζ is REFUSED").

The physics revision says the opposite, deliberately and with reasons:

- `07` §6/§9 and `99` §7 publish a **fixed** ±30 % band (±50 % at 20–50 mm/s, none below 20), which
  `07` §8 instructs the UI to show;
- `01` §4.4 makes `f_blowoff` and `c_post` `ASSUME(4.0, flag estimatedDamper)` / `ASSUME(12, …)`, not
  REFUSE, precisely so ζ is computable from a file a racer can produce (that was blocker C1).

Both cannot be normative. Either §4.8 adopts the fixed band + ASSUME policy (one edit) or `07` §6/§9
and `99` §7 must be rewritten to a computed band and ζ becomes uncomputable without a dyno. Inheritors:
`spec.md` §4.8/§4.3.1, `01` §4.4, `07` §5/§6/§8/§9, `99` §2.1 (V12) and §7.

### D-4 (medium) — `99` V15's "±0.26 pp" is understated by 40 %

At `k_ch = 21.60`, ±20 % gives 25.92 and 17.28 N·m/rad, and balance **52.99 % / 52.17 %** → **±0.41 pp**,
not ±0.26. The 0.26 comes from the secant between the two printed table rows
((53.87−52.63)/(42.19−21.60) × 4.32), which linearises a concave response. The conclusion ("below the
±1.5 pp floor") survives; the number does not. Related: `99` §11's "3× wrong → 2 pp" is 1.85 pp.
Inheritors: `99` §2.1 (V15), §11.

### D-5 (medium) — `06` §6.7's two derived figures disagree with its own table

- *"TLLT ±14.4 % and φ ±23 % over the same range, i.e. roughly **±1.6 % of load per mm** of h"*. TLLT is
  exactly linear in `h`: 13.2435 × 0.001/0.173 = 0.0766 N per mm = **3.57 %/mm** (and the table's own
  ±14.3 % over ±4 mm is 3.6 %/mm). The 1.6 % figure is off by 2.2×.
- *"A 3 mm CG error moves the balance by **0.12 pp**"*: 28 → 31 mm gives **0.090 pp** (and 99 §7's
  "±0.14 pp" is the *half-span* over ±4 mm, a different quantity).

Both are parenthetical; neither changes a conclusion, but both are quotable numbers in a document that
insists others be derived.

### D-6 (low) — `05` §6.2's front ride frequency is 10.782 Hz; it is 10.781 Hz

√(1118.51/0.24375) = 67.7404 rad/s; 67.7404/2π = **10.7812 Hz**. The document prints ω_n = 67.741 and
then divides it to 10.782 — a division slip, 0.001 Hz. `00` §5 and G05.3 repeat 10.782. (The rear,
10.286, is correct.)

### D-7 (low) — `99` §2.1's κ floor for a 0.2 mm session is optimistic

*"a 0.2 mm session puts κ itself at ~±6 %"*. That figure only holds if the three re-measured points are
good to ±0.1 mm and the rest to ±0.3 mm (RSS = 6.7 %). At a **uniform** ±0.2 mm — which is what "a 0.2 mm
session" means and what §3.2's first pass delivers — the document's own Jacobian gives ±0.2 mm on `Uᵢ.z`
alone as ±8.8 %, and RSS over the six coordinates as **±13 %**. V2's ±10 % pass mark is then inside the
geometry noise it is meant to bound. State which uncertainty the 6 % assumes, or raise the mark.
Inheritors: `99` §2.1 (V2), §3.2, §7.

### D-8 (low) — `02` §6.9's `tie_out` position at +2 mm does not match the transform it illustrates

The doc prints `tie_out(θ) = Lₒ + u·ê₁ + v·ê₂ = (74.0543, 33.948)`. The height is right; the y is
**74.0945**, not 74.0543 (and the table below it uses the correct value). A 0.04 mm slip in a worked
example whose point is that the transform is checkable by hand.

### D-9 (low) — `99` §7's V3 floor is 0.37–**0.93** mm, not 0.37–0.94 mm

0.5 mm × 1.869 mm/mm = 0.935. Rounding to 0.94 needs 1.88. (The 02 §9 table's own per-mm values range
−1.87 to −1.92, so 0.94 is defensible only if quoted against the +1.0 mm row.)

### D-10 (low) — `04` §6.5's `dTₒ/dbump` is 0.0547, not 0.053

From the carrier transform at ±0.5 mm: `(0.0547, 0.9771)` mm per mm. The 57 %/43 % split of
`û_yz·dTₒ/dbump` is unaffected (57.3/42.7).

### D-11 (low) — `02` §3.2.2's "W.z peaks at 73.9 mm"

The maximum of `W.z` over ±1 rad is **73.77 mm** (at θ = 0.896 rad). 0.2 % — but it is stated as a
testable property of the scan.

### D-12 (cosmetic) — three printed derived values differ in the last digit

- `01` §8.3: `ê₁ = (−0.139170, 0.990268)`; the components give **−0.139173**. The `(u, v)` derived from
  it are correct to 4 dp.
- `04` §6.4's `z_Tᵢ` sensitivity table: its "coefficient" column is the ±0.2 mm central difference, but
  at the ends it reads −0.503/+0.164 where the model gives **−0.487/+0.163** (≤3 %).
- `04` §6.4: τ(+4) = −1.289 vs **−1.290**.

### D-13 (documentation risk) — two different "reference cars"

`spec.md` §4.2's normative example model and `01` §8's reference car share a 257 mm wheelbase and
nothing else: track 163 vs 172 mm, tyre radius 31 vs 32 mm, `cg.height` 38 vs 28 mm, unsprung 2 × 157 g vs
240 g total, sprung 486/552 g vs 487.49/622.49 g per axle. The spec example is also internally
inconsistent: `cg.longitudinal_front = 50.5` against the 47.6 % front its own masses give. An
implementer who loads the only complete model in the normative document will reproduce none of the
physics golden cases. Either say explicitly that §4.2 is a schema example, not the reference car, or
use the reference car's numbers.

Also in `spec.md` §4 (contract-level, not arithmetic): §4.4 gives **roll stiffness in N·m/deg** where
`05` §3.3, `06` (6.6) and `99` §7 use **N·m/rad** — a 57.3× mismatch in the shipped output table; the
same table's "camber gain deg/deg" (vs module 2's °/mm headline) and "roll-centre migration mm per 0.5°"
(vs `02` §3.5's ±1°/±2° reporting) are definition mismatches. And `01` §4.4 makes `cg.height`
`ASSUME(component estimate, flag cgInferred)` where `spec.md` §4.2.1 requires
`ESTIMATE(two_hang_plumb_line)` and §4.1(iii) calls `ASSUME` on exactly this field a schema error.

---

## 15. What I could not verify (assumptions the numbers depend on)

These inputs are stated as assumptions in the documents; every value that depends on them is a
function of the assumption, not an independent result. I verified the *arithmetic given the assumption*
and, where the document makes a sensitivity claim, the claim.

1. **`IR_r = 0.7071`** (rear installation ratio; the reference car has no rear hardpoints). Everything
   rear: `k_w,r` = 1.29998 N/mm, `f_rear` = 10.286 Hz, `c_crit,r` = 40.230, `k_φ,r` = 28.368, and hence
   the 56.14 % balance and the 52.63 % flexible-chassis balance. `05` §6.5's "10 % error in `IR_r` →
   5 % in frequency" is correct (f ∝ IR).
2. **`z_rc,r = 6.000 mm`** (assumed, range 0–20). Drives `h_ra`, `ΔW_geo,r`, the residual and balance.
   Sensitivities I did not test independently because the doc gives no claim.
3. **`w_f = 0.45`, `h = 28.0 mm`, `m_u = 240 g`, `h_u = 20.0 mm`** — the whole of module 6. (See D-1
   for the `w_f`/`x_cg` conflict.)
4. **`F_bo = 4.0 N`, `c_post = 12 N·s/m`, `C_d = 0.62`, `ρ = 950 kg/m³`, `B = 1200 K`, ν_ref = 500 cSt** —
   every ζ, K_h and v_bo. The ±30 % band is the document's own statement of this.
5. **Chassis module: `G_CFRP = 27 GPa`, `w = 90`, `L_ch = 300`, `z_ch = 8.0 mm`, `κ_rail = 1.0`.** The
   `k_ch` values are exact functions of these; the ±1–3× estimator range is stated.
6. **`K_bf = 0.55`** (module 3) — the 773.1 % anti-dive scales linearly with it.
7. **The §9 Jacobian's method** (perturb the hardpoint, re-derive the carrier offsets from the perturbed
   static state, hold `W.z = 32.000`). I matched the printed table only under this reading; holding the
   offsets fixed instead returns zero Δz_rc for `Uₒ`/`Uᵢ` perturbations, which cannot be what the table
   means. The document should say which method it means, because a developer can implement the other
   one and fail all six rows.
8. **`m_s = 0.24375` front** — reproduced, but it is only correct if `w_f = 0.45`, which is the same
   assumption D-1 shows the `x_cg` line contradicts.

---

## 16. Count

| Group | Module | Verdict |
|---|---|---|
| 1 | 02 sensitivity Jacobian | reproduced exactly, every row |
| 2 | 02 mirroring | reproduced exactly, every row |
| 3 | 02 carrier transform / toe column | reproduced exactly; one 0.04 mm slip in a worked line (D-8) |
| 4 | 05/07 masses, frequencies, ζ | reproduced; **f_front 10.782 → 10.781** (D-6); ζ(99.1) 0.5066 → 0.5065 |
| 5 | 07 direction table | reproduced; −43.7 % prints as −43.76 % |
| 6 | 10 chassis | reproduced exactly, every row |
| 7 | 04 toe/Ackermann | reproduced; τ(+4) −1.289 → −1.290 |
| 8 | 03 hinge readings | reproduced exactly, every row |
| 9 | 99 V2/V3 secants | reproduced; floor 0.94 → 0.93 (D-9) |
| 10 | balance sensitivity | reproduced within rounding; **V15 ±0.26 → ±0.41 pp** (D-4), 0.12 → 0.09 pp and 1.6 %/mm → 3.6 %/mm (D-5) |
| 11 | 06 load transfer | reproduced exactly, every row — **on an `x_cg` that contradicts the doc's own `w_f`** (D-1) |
| 12 | 01 §4.5 CG | reproduced exactly, every row |

**12 of 12 groups reproduce; 7 exactly at printed precision, 5 to last-digit agreement.** Of the
thirteen discrepancies above, one (D-1) invalidates a stated explanation in two documents and moves
every number downstream of `φ` (about twenty printed values across modules 6 and 10); one (D-2) is a
label whose misreading moves the roll centre by 1.4 mm; one (D-3) is a live contradiction between the
normative spec and the physics; the rest are number-level corrections that change no conclusion.
