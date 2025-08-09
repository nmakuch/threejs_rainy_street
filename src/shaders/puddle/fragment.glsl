uniform float uTime;

varying vec3 vPosition;
varying vec2 vUv;
varying vec3 vWorldPosition;

vec3 csm_PuddleNormal;
float csm_PuddleNormalMask;

#define MAX_RADIUS 1
#define HASHSCALE1 .1031
#define HASHSCALE3 vec3(.1031, .1030, .0973)

float hash12(vec2 p) {
    vec3 p3  = fract(vec3(p.xyx) * HASHSCALE1);
    p3 += dot(p3, p3.yzx + 19.19);
        
    return fract((p3.x + p3.y) * p3.z);
}

vec2 hash22(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * HASHSCALE3);
    p3 += dot(p3, p3.yzx+19.19);
        
    return fract((p3.xx+p3.yz)*p3.zy);
}

vec3 getRipples(vec2 uv) {
    vec2 p0 = floor(uv);

    float time = uTime * 3.0;

    vec2 circles = vec2(0.0, 0.0);
    for (int j = -MAX_RADIUS; j <= MAX_RADIUS; ++j) {
        for (int i = -MAX_RADIUS; i <= MAX_RADIUS; ++i) {
            vec2 pi = p0 + vec2(i, j);
            vec2 hsh = pi;
            vec2 p = pi + hash22(hsh);

            float t = fract(0.3 * time + hash12(hsh));
            vec2 v = p - uv;
            float d = length(v) - (float(MAX_RADIUS) + 1.0) * t;

            float h = 1e-3;
            float d1 = d - h;
            float d2 = d + h;
            float p1 = sin(31.*d1) * smoothstep(-0.6, -0.3, d1) * smoothstep(0., -0.3, d1);
            float p2 = sin(31.*d2) * smoothstep(-0.6, -0.3, d2) * smoothstep(0., -0.3, d2);
            circles += 0.5 * normalize(v) * ((p2 - p1) / (2. * h) * (1. - t) * (1. - t));
        }
    }
        
    circles /= float((MAX_RADIUS*2+1)*(MAX_RADIUS*2+1));
    float intensity = mix(0.01, 0.15, smoothstep(0.1, 0.6, abs(fract(0.05*time + 0.5)*2.-1.)));
    vec3 n = vec3(circles, sqrt(1.0 - dot(circles, circles)));
    
    return n;
}

float getPuddle(vec2 uv) {
    gln_tFBMOpts puddleNoiseOpts = gln_tFBMOpts(1.0, 0.5, 2.0, 0.5, 1.0, 3, false, false);
    float puddleNoise = gln_sfbm((uv + vec2(3.0, 0.0)) * 0.2, puddleNoiseOpts);
    puddleNoise = gln_normalize(puddleNoise);
    puddleNoise = smoothstep(0.0, 0.7, puddleNoise);
    
    return puddleNoise;
}

float sdCircle(vec2 p, float radius) {
    return length(p) - radius;
}

vec3 perturbNormal(vec3 inputNormal, vec3 noiseNormal, float strength) {
	vec3 noiseNormalOrthogonal = noiseNormal - (dot(noiseNormal, inputNormal) * inputNormal);
	vec3 noiseNormalProjectedBump = mat3(csm_internal_vModelViewMatrix) * noiseNormalOrthogonal;
	
    return normalize(inputNormal - (noiseNormalProjectedBump * strength));
}

void main() {
	// vec4 puddleTexColor = texture2D(uRippleTexture, vUv);
	float puddleNoise = getPuddle(vPosition.xz * 15.0);

	// // Normals
	csm_PuddleNormal = vNormal;
	csm_PuddleNormalMask = smoothstep(0.2, 1.0, puddleNoise);

    // Generate noisy normals
	gln_tFBMOpts noiseNormalNoiseOpts = gln_tFBMOpts(1.0, 0.5, 2.0, 0.5, 1.0, 4, false, false);
	vec3 noiseNormalPosition = vPosition * 10.0;
	noiseNormalPosition.y += uTime * 1.0;

	// // Roughness
    float prevRoughness = csm_Roughness;
	csm_Roughness = 0.0 - csm_PuddleNormalMask;
	csm_Roughness = clamp(csm_Roughness, 0.0, 1.0);

    // // Ripples
	vec3 rippleNormals = getRipples(vPosition.xz * 40.0);
	csm_PuddleNormal = perturbNormal(csm_PuddleNormal, rippleNormals, 0.25 * 1.0);

    float circle = 1.0 - sdCircle(vWorldPosition.xz, 0.2);
    circle = smoothstep(0.8, 1.0, circle); 
    
    csm_DiffuseColor.a = circle;
}