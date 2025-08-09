varying vec3 vPosition;
varying vec2 vUv;
varying vec3 vWorldPosition;

void main() {
    // Position
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * modelPosition;

    // Varyings
	vPosition = position;
	vUv = uv;
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
}