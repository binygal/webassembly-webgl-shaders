

class Context {
public:
    Context (int width, int height, char * id);

    ~Context (void);

    void setupTexture(const GLchar * name, GLenum texture, uint8_t* buffer, int samplerNum);
    void setup();
    void setupMainTexture (uint8_t* buffer);
    void setupSecondaryTexture (uint8_t* buffer);
    void run ();

private:
    int width;
    int height;

    GLuint programObject;
    GLuint vertexShader;
    GLuint fragmentShader;

    EMSCRIPTEN_WEBGL_CONTEXT_HANDLE context;

};