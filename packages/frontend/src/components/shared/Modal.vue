<template>
    <div class="Modal">
        <div class="mo-container">
            <div class="mo-title"><slot name="title">Title</slot></div>

            <div class="mo-template"><slot name="template">Content</slot></div>

            <div class="mo-buttons">
                <div class="mo-button" style="margin-right: 5px" v-if="$slots.cancle">
                    <slot name="cancle">Cancle</slot>
                </div>
                <div class="mo-button" style="margin-right: 5px" v-if="$slots.delete">
                    <slot name="delete">Delete</slot>
                </div>
                <div class="mo-button" v-if="$slots.confirm">
                    <slot name="confirm">Confirm</slot>
                </div>   
            </div>

            <slot name="loading"></slot>
        </div>
    </div>
</template>

<style>
.Modal{
    position: fixed;
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 99;
    width: 100vw;
    height: 100vh;
    top: 0;
    left: 0;
    background: rgba(0, 0, 0, 0.8);
}
.mo-container{
    position: absolute;
    background: var(--bp-surface);
    padding: 50px;
    width: 50%;
}
/* Title */
.mo-title{
    font-size: 25px;
    margin-bottom: 20px;
}

/* Template */
.mo-template div{
    font-size: 18px;
}
.mo-template input{
    color: var(--bp-text-strong);
    margin-bottom: 20px;
    width: 100%;     /* Padding left & right 5 px */
    padding: 5px;
    border: 1px solid var(--bp-text-strong);
    border-radius: 2px;
    font-size: 18px;
    outline: none;
}
.mo-template button{
    background: var(--main-color);
    padding: 20px;
    cursor: pointer;
    color: white;
    text-align: center;
    width: 100%;
    border: none;
    margin-bottom: 20px;
}
.mo-template button:hover{
    background: var(--main-color-hover);
}

/* Buttons */
.mo-buttons{
    display: flex;
    width: 100%;
}
.mo-button{
    width: 50%;
}
.mo-button div{
    background: var(--main-color);
    padding: 20px;
    cursor: pointer;
    color: white;
    text-align: center;
}
.mo-button div:hover{
    background: var(--main-color-hover);
}

/*MOBILE*/
@media (width <= 900px){
    .mo-container{
        width: 95%;
        padding: 20px 10px;
    }
}
</style>
