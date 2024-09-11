import React, { useState, useEffect } from "react";
import {
	Image,
	Text,
	ScrollView,
	View,
	Button,
	TextInput,
	Modal,
	ActivityIndicator,
	Alert,
	FlatList,
	TouchableOpacity,
} from "react-native";
import axios from "axios";
import { Buffer } from "buffer";
import * as ImagePicker from "expo-image-picker";
import { ImagePickerAsset } from "expo-image-picker";

const ProgressBar = ({ progress }: { progress: number }) => {
	return (
		<View
			style={{
				width: "100%",
				backgroundColor: "#e0e0e0",
				borderRadius: 5,
				overflow: "hidden",
				alignItems: "center",
				justifyContent: "center",
				marginTop: 10,
			}}
		>
			<View
				style={[
					{
						height: 10,
						backgroundColor: "#3b5998",
					},
					{ width: `${progress}%` },
				]}
			/>
			<Text>{Math.round(progress)}%</Text>
		</View>
	);
};

interface ImageInterface {
	imageName: string;
	imageUrl: string;
	sha: string;
}
interface CategoryImage {
	categoryName: string;
	images: ImageInterface[];
}

export default function HomeScreen() {
	// Данные о категориях и фотографиях в них
	const [data, setData] = useState<CategoryImage[]>([]);
	const [newCategoryName, setNewCategoryName] = useState("");
	const [loading, setLoading] = useState(false);
	const [uploadProgress, setUploadProgress] = useState<number>(0);
	const [totalImages, setTotalImages] = useState<number>(0);
	const [uploadedImages, setUploadedImages] = useState<number>(0);

	const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
	const [showSelectCategoryModal, setShowSelectCategoryModal] =
		useState(false);

	useEffect(() => {
		fetchCategories();
	}, []);

	// Запрос разрешения и выбор изображения
	const pickImageFromGallery = async (selectedCategory: string) => {
		const { status } =
			await ImagePicker.requestMediaLibraryPermissionsAsync();
		if (status !== "granted") {
			alert("Необходимо разрешение на доступ к галерее!");
			return;
		}

		const result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ImagePicker.MediaTypeOptions.Images,
			allowsMultipleSelection: true,
			aspect: [4, 3],
			quality: 1,
		});

		if (!result.canceled) {
			handleUploadImages(result.assets, selectedCategory);
		}
	};

	// Загрузка изображения
	const handleUploadImages = async (
		images: ImagePickerAsset[],
		selectedCategory: string
	) => {
		setLoading(true);
		const username = "IvanOrlovsky";
		const reponame = "forged-dragon";
		const categoryPath = `public/category/${selectedCategory}`;
		const token = process.env.EXPO_PUBLIC_GITHUB_TOKEN;

		setTotalImages(images.length);
		setUploadedImages(0);

		for (let image of images) {
			try {
				const response = await fetch(image.uri);
				const blob = await response.blob();
				const reader = new FileReader();

				reader.onloadend = async () => {
					const base64data = reader.result?.toString().split(",")[1];
					const uploadResponse = await axios.put(
						`https://api.github.com/repos/${username}/${reponame}/contents/${categoryPath}/${Date.now()}.jpg`,
						{
							message: `Добавление нового изображения в категорию ${selectedCategory}`,
							content: base64data,
						},
						{
							headers: {
								Authorization: `token ${token}`,
							},
						}
					);

					if (uploadResponse.status === 201) {
						setUploadedImages((prev) => prev + 1);
						setUploadProgress(
							((uploadedImages + 1) / totalImages) * 100
						);
						fetchCategories(); // Обновляем список категорий
					} else {
						Alert.alert(
							"Ошибка",
							"Не удалось загрузить изображение"
						);
					}
				};

				reader.readAsDataURL(blob);
			} catch (error) {
				Alert.alert("Ошибка", "Ошибка при добавлении изображения");
				console.error(error);
			} finally {
				if (uploadedImages === totalImages) {
					setUploadProgress(0);
					setUploadedImages(0);
					setTotalImages(0);
					setLoading(false);
				}
			}
		}
	};

	// Получение категорий
	const fetchCategories = async () => {
		setLoading(true);
		const username = "IvanOrlovsky";
		const reponame = "forged-dragon";
		const categoryPath = "public/category";
		const token = process.env.EXPO_PUBLIC_GITHUB_TOKEN;

		try {
			const response = await axios.get(
				`https://api.github.com/repos/${username}/${reponame}/contents/${categoryPath}`,
				{
					headers: {
						Authorization: `token ${token}`,
					},
				}
			);

			const categories = await Promise.all(
				response.data.map(async (item: any) => {
					const images = await fetchImages(item.name);
					return { categoryName: item.name, images };
				})
			);

			setData(categories);
		} catch (error) {
			Alert.alert("Ошибка", "Ошибка при получении категорий");
			console.error(error);
		} finally {
			setLoading(false);
		}
	};

	// Получение изображений в категории
	const fetchImages = async (
		categoryName: string
	): Promise<ImageInterface[]> => {
		const username = "IvanOrlovsky";
		const reponame = "forged-dragon";
		const categoryPath = `public/category/${categoryName}`;
		const token = process.env.EXPO_PUBLIC_GITHUB_TOKEN;

		try {
			const response = await axios.get(
				`https://api.github.com/repos/${username}/${reponame}/contents/${categoryPath}`,
				{
					headers: {
						Authorization: `token ${token}`,
					},
				}
			);

			return await Promise.all(
				response.data.map(async (image: any) => {
					const imageResponse = await axios.get(image.git_url, {
						headers: {
							Authorization: `token ${token}`,
							Accept: "application/vnd.github.VERSION.raw",
						},
						responseType: "arraybuffer",
					});

					const base64Image = Buffer.from(
						imageResponse.data,
						"binary"
					).toString("base64");
					return {
						imageName: image.name,
						imageUrl: `data:image/webp;base64,${base64Image}`,
						sha: image.sha,
					};
				})
			);
		} catch (error) {
			console.error(error);
			return [];
		}
	};

	// Добавление новой категории
	const addCategory = async () => {
		if (!newCategoryName) {
			Alert.alert("Ошибка", "Нельзя давать пустое название категории");
			return;
		}

		setLoading(true);
		const username = "IvanOrlovsky";
		const reponame = "forged-dragon";
		const categoryPath = `public/category/${newCategoryName}`;
		const token = process.env.EXPO_PUBLIC_GITHUB_TOKEN;

		try {
			await axios.put(
				`https://api.github.com/repos/${username}/${reponame}/contents/${categoryPath}/.gitkeep`,
				{
					message: `Add new category ${newCategoryName}`,
					content: Buffer.from("").toString("base64"),
				},
				{
					headers: {
						Authorization: `token ${token}`,
					},
				}
			);

			Alert.alert("Успех", `Категория ${newCategoryName} добавлена`);
			setNewCategoryName("");
			fetchCategories(); // Обновляем список категорий
		} catch (error) {
			Alert.alert("Ошибка", "Ошибка при добавлении категории");
			console.error(error);
		} finally {
			setLoading(false);
		}
	};

	// Удаление изображения
	const deleteImage = async (
		categoryName: string,
		imageName: string,
		sha: string
	) => {
		Alert.alert(
			"Подтверждение",
			`Вы уверены, что хотите удалить изображение ${imageName}?`,
			[
				{ text: "Отмена", style: "cancel" },
				{
					text: "Удалить",
					onPress: async () => {
						setLoading(true);
						const username = "IvanOrlovsky";
						const reponame = "forged-dragon";
						const token = process.env.EXPO_PUBLIC_GITHUB_TOKEN;

						try {
							await axios.delete(
								`https://api.github.com/repos/${username}/${reponame}/contents/public/category/${categoryName}/${imageName}`,
								{
									data: {
										message: `Delete image ${imageName}`,
										sha,
									},
									headers: {
										Authorization: `token ${token}`,
									},
								}
							);

							setLoading(true);

							// Проверяем состояние репозитория
							let attempts = 0;
							const maxAttempts = 10;
							let deleted = false;

							while (attempts < maxAttempts && !deleted) {
								try {
									// Попробуем получить изображение, чтобы проверить, удалено ли оно
									await axios.get(
										`https://api.github.com/repos/${username}/${reponame}/contents/public/category/${categoryName}/${imageName}`,
										{
											headers: {
												Authorization: `token ${token}`,
											},
										}
									);
								} catch (err) {
									if (axios.isAxiosError(err)) {
										if (err.response?.status === 404) {
											// Если изображение не найдено, значит оно удалено
											deleted = true;
										}
									} else {
										console.error(
											"Неизвестная ошибка:",
											err
										);
									}
								}

								if (!deleted) {
									attempts++;
									await new Promise((resolve) =>
										setTimeout(resolve, 500)
									);
								}
							}

							if (deleted) {
								setLoading(false);
								Alert.alert(
									"Успех",
									`Изображение ${imageName} удалено`
								);
								await fetchCategories(); // Обновляем список категорий после удаления
							} else {
								Alert.alert(
									"Ошибка",
									"Не удалось проверить удаление изображения"
								);
							}
						} catch (error) {
							Alert.alert(
								"Ошибка",
								"Ошибка при удалении изображения"
							);
							console.error(error);
						} finally {
							setLoading(false);
						}
					},
				},
			]
		);
	};

	// Рендер изображений
	const renderCategoryImages = (category: CategoryImage) => {
		return (
			<View key={category.categoryName} style={{ marginBottom: 20 }}>
				<Text style={{ fontSize: 18, fontWeight: "bold" }}>
					{category.categoryName}
				</Text>
				<ScrollView horizontal>
					{category.images.map((image) => (
						<View key={image.imageName} style={{ marginRight: 10 }}>
							<Image
								source={{ uri: image.imageUrl }}
								style={{ width: 100, height: 100 }}
								resizeMode="cover"
							/>
							<Button
								title="Удалить"
								color="red"
								onPress={() =>
									deleteImage(
										category.categoryName,
										image.imageName,
										image.sha
									)
								}
							/>
						</View>
					))}
				</ScrollView>
			</View>
		);
	};

	return (
		<View style={{ flex: 1, gap: 8, padding: 20, marginVertical: 40 }}>
			<View style={{ flex: 1 }}>
				<Text
					style={{
						fontSize: 24,
						fontWeight: "bold",
						marginBottom: 10,
					}}
				>
					Галерея категорий
				</Text>
				{loading ? (
					<View
						style={{
							flex: 1,
							justifyContent: "center",
							alignItems: "center",
						}}
					>
						<ActivityIndicator size="large" color="#0000ff" />
						{totalImages > 0 && (
							<View>
								<Text>
									Загрузка {uploadedImages} из {totalImages}{" "}
									изображений
								</Text>
								<ProgressBar progress={uploadProgress / 100} />
							</View>
						)}
					</View>
				) : (
					<FlatList
						data={data}
						renderItem={({ item }) => renderCategoryImages(item)}
						keyExtractor={(item) => item.categoryName}
					/>
				)}
			</View>

			<Button
				title="Добавить изображения"
				onPress={() => setShowSelectCategoryModal(true)}
			/>

			<Button
				title="Добавить категорию"
				onPress={() => setShowAddCategoryModal(true)}
			/>

			{/* Модальное окно добавления категории */}
			<Modal
				visible={showAddCategoryModal}
				animationType="slide"
				onRequestClose={() => setShowAddCategoryModal(false)}
			>
				<View
					style={{
						padding: 20,
						flex: 1,
						justifyContent: "center",
						alignItems: "center",
						gap: 8,
					}}
				>
					<Text style={{ fontSize: 18 }}>
						Введите название категории:
					</Text>
					<TextInput
						value={newCategoryName}
						onChangeText={setNewCategoryName}
						style={{
							borderWidth: 1,
							marginVertical: 10,
							padding: 5,
							alignSelf: "stretch",
						}}
					/>
					<TouchableOpacity
						style={{
							alignSelf: "stretch",
							borderWidth: 1,
							padding: 10,
							backgroundColor: "#4169E1",
						}}
						onPress={addCategory}
					>
						<Text style={{ color: "white", textAlign: "center" }}>
							Создать
						</Text>
					</TouchableOpacity>
					<TouchableOpacity
						style={{
							borderWidth: 1,
							padding: 10,
							backgroundColor: "#4169E1",
							alignSelf: "stretch",
						}}
						onPress={() => setShowAddCategoryModal(false)}
					>
						<Text style={{ color: "white", textAlign: "center" }}>
							Закрыть
						</Text>
					</TouchableOpacity>
				</View>
			</Modal>

			{/* Модальное окно для выбора категории куда загрузить изображение */}
			<Modal
				visible={showSelectCategoryModal}
				transparent
				animationType="slide"
			>
				<View
					style={{
						flex: 1,
						justifyContent: "center",
						alignItems: "center",
						backgroundColor: "rgba(0,0,0,0.5)",
					}}
				>
					<View
						style={{
							width: 300,
							backgroundColor: "white",
							borderRadius: 10,
							padding: 20,
						}}
					>
						<Text>
							Выберите в какую категорию загрузить изображение:
						</Text>
						<FlatList
							style={{ marginVertical: 8 }}
							data={data.map((category) => category.categoryName)}
							keyExtractor={(item) => item}
							renderItem={({ item }) => (
								<TouchableOpacity
									onPress={() => {
										pickImageFromGallery(item);
										setShowSelectCategoryModal(false);
									}}
								>
									<Text
										style={{
											padding: 10,
											fontWeight: "bold",
										}}
									>
										{item}
									</Text>
								</TouchableOpacity>
							)}
						/>

						<TouchableOpacity
							style={{
								borderWidth: 1,
								padding: 10,
								backgroundColor: "#4169E1",
							}}
							onPress={() => setShowSelectCategoryModal(false)}
						>
							<Text
								style={{ color: "white", textAlign: "center" }}
							>
								Отмена
							</Text>
						</TouchableOpacity>
					</View>
				</View>
			</Modal>
		</View>
	);
}
